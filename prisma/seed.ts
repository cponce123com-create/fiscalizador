import 'dotenv/config';

import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../lib/generated/prisma/client';
import { CAMPOS_INTERNOS } from '../services/mappingService';

/**
 * Datos iniciales del sistema.
 *
 * Es idempotente: usa `upsert` en todo, así que puede ejecutarse tantas veces
 * como haga falta sin duplicar ni pisar datos de importación.
 *
 * Los valores de los catálogos NO son inventados: `Estado`, `Tipo de Orden` y
 * `Tipo de Contratación` reproducen los del libro real del Portal de
 * Transparencia (ver docs/reference/FORMATOS.md).
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Falta DATABASE_URL. Revisa tu archivo .env (ver .env.example).');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

/** Gestiones de gobierno. Se agregan nuevas sin tocar código. */
const GESTIONES = [
  {
    name: '2015-2018',
    startDate: new Date(Date.UTC(2015, 0, 1)),
    endDate: new Date(Date.UTC(2018, 11, 31)),
    description: 'Periodo de gobierno 2015-2018',
  },
  {
    name: '2019-2022',
    startDate: new Date(Date.UTC(2019, 0, 1)),
    endDate: new Date(Date.UTC(2022, 11, 31)),
    description: 'Periodo de gobierno 2019-2022',
  },
  {
    name: '2023-2026',
    startDate: new Date(Date.UTC(2023, 0, 1)),
    endDate: new Date(Date.UTC(2026, 11, 31)),
    description: 'Periodo de gobierno 2023-2026',
  },
];

/**
 * Catálogo de estados.
 *
 * `isCancelled` y `countsEconomically` son DATOS, no lógica en el código: así el
 * administrador puede clasificar un estado nuevo sin desplegar la aplicación
 * (docs/prompt.md secciones 14 y 31).
 */
const ESTADOS = [
  {
    code: 'DEVENGADA',
    label: 'Devengada',
    aliases: ['devengado', 'devengadas', 'devengados', 'devengada ', 'ejecutada'],
    countsEconomically: true,
    isCancelled: false,
    isUnknown: false,
    position: 1,
  },
  {
    code: 'ANULADA',
    label: 'Anulada',
    aliases: [
      'anulado',
      'anuladas',
      'anulados',
      'cancelada',
      'cancelado',
      'canceladas',
      'cancelados',
      'anulacion',
    ],
    countsEconomically: false,
    isCancelled: true,
    isUnknown: false,
    position: 2,
  },
  {
    // Red de seguridad: cualquier estado no catalogado cae aquí, se advierte y
    // NO suma al monto considerado hasta que un administrador lo clasifique.
    code: 'DESCONOCIDO',
    label: 'Desconocido',
    aliases: [],
    countsEconomically: false,
    isCancelled: false,
    isUnknown: true,
    position: 99,
  },
];

const TIPOS_ORDEN = [
  { code: 'O/C', label: 'Orden de Compra', aliases: ['oc', 'orden de compra'], position: 1 },
  { code: 'O/S', label: 'Orden de Servicio', aliases: ['os', 'orden de servicio'], position: 2 },
];

const TIPOS_CONTRATO = [
  {
    code: 'HASTA_8_UIT',
    label:
      'Contrataciones hasta 8 UIT (LEY 30225)((No incluye las derivadas de contrataciones por catálogo electrónico.)',
    aliases: [],
    position: 1,
  },
  {
    code: 'PROCESO_SELECCION',
    label: 'Deviene de Procesos de Selección',
    aliases: [],
    position: 2,
  },
];

async function sembrarCatalogos() {
  for (const gestion of GESTIONES) {
    await prisma.managementPeriod.upsert({
      where: { name: gestion.name },
      update: {
        startDate: gestion.startDate,
        endDate: gestion.endDate,
        description: gestion.description,
      },
      create: gestion,
    });
  }

  for (const estado of ESTADOS) {
    await prisma.orderStatus.upsert({
      where: { code: estado.code },
      update: {
        label: estado.label,
        aliases: estado.aliases,
        countsEconomically: estado.countsEconomically,
        isCancelled: estado.isCancelled,
        isUnknown: estado.isUnknown,
        position: estado.position,
      },
      create: estado,
    });
  }

  for (const tipo of TIPOS_ORDEN) {
    await prisma.orderType.upsert({
      where: { code: tipo.code },
      update: { label: tipo.label, aliases: tipo.aliases, position: tipo.position },
      create: tipo,
    });
  }

  for (const tipo of TIPOS_CONTRATO) {
    await prisma.contractType.upsert({
      where: { code: tipo.code },
      update: { label: tipo.label, aliases: tipo.aliases, position: tipo.position },
      create: tipo,
    });
  }

  console.log(
    `Catálogos: ${GESTIONES.length} gestiones, ${ESTADOS.length} estados, ` +
      `${TIPOS_ORDEN.length} tipos de orden, ${TIPOS_CONTRATO.length} tipos de contratación.`,
  );
}

/**
 * Visibilidad pública de las columnas.
 *
 * Es GLOBAL por campo interno, no por lote: desactivar una columna nunca la borra
 * de la base de datos y puede reactivarse sin reimportar nada
 * (docs/prompt.md secciones 6 y 44).
 */
async function sembrarVisibilidadColumnas() {
  for (const [indice, campo] of CAMPOS_INTERNOS.entries()) {
    await prisma.columnVisibility.upsert({
      where: { internalField: campo.field },
      update: {
        label: campo.label,
        description: campo.description,
        position: indice,
      },
      // `isPublic` se fija solo al crear: si un administrador la desactivó, el
      // seed no debe reactivarla por encima de su decisión.
      create: {
        internalField: campo.field,
        label: campo.label,
        description: campo.description,
        isPublic: campo.isPublic,
        position: indice,
      },
    });
  }

  console.log(`Visibilidad de columnas: ${CAMPOS_INTERNOS.length} campos.`);
}

async function sembrarSuperadmin() {
  const email = process.env.SEED_SUPERADMIN_EMAIL;
  const password = process.env.SEED_SUPERADMIN_PASSWORD;

  if (!email || !password) {
    console.log(
      'Superadmin: omitido. Define SEED_SUPERADMIN_EMAIL y SEED_SUPERADMIN_PASSWORD para crearlo.',
    );
    return;
  }

  if (password.length < 12) {
    throw new Error('SEED_SUPERADMIN_PASSWORD debe tener al menos 12 caracteres.');
  }

  // argon2id con los parámetros por defecto de @node-rs/argon2.
  const passwordHash = await hash(password);

  await prisma.user.upsert({
    where: { email },
    update: { role: 'SUPERADMIN', isActive: true },
    create: {
      email,
      name: 'Superadministrador',
      passwordHash,
      role: 'SUPERADMIN',
      isActive: true,
    },
  });

  console.log(`Superadmin: ${email} listo.`);
}

async function main() {
  console.log('Sembrando datos iniciales...');
  await sembrarCatalogos();
  await sembrarVisibilidadColumnas();
  await sembrarSuperadmin();
  console.log('Seed completado.');
}

main()
  .catch((error) => {
    console.error('El seed falló:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
