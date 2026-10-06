import { prisma } from '@/lib/prisma';
import { ErrorDeNegocio, NoEncontrado } from '@/lib/errors';
import { contextoDePeticion, registrarAuditoria, type ClienteDb } from '@/services/auditService';
import { slugify } from '@/services/normalization';

/**
 * Personas señaladas por la administración y sus vínculos con proveedores.
 *
 * El vínculo no se inventa: el RUC de una persona natural es
 * `10 + DNI + dígito verificador`, así que encontrar un DNI dentro de un RUC es una
 * coincidencia verificable, no una suposición. Por eso los vínculos deducidos NO se
 * guardan: se calculan al vuelo, y un proveedor que se importe mañana queda
 * vinculado sin que nadie tenga que resincronizar nada. En la base de datos solo
 * viven los vínculos que un administrador afirma a mano (una empresa de la que la
 * persona es titular, por ejemplo).
 *
 * El DNI no sale de aquí hacia el portal público: la sección pública muestra el
 * nombre, la descripción y la fuente (Ley 29733 de protección de datos personales).
 *
 * El monto considerado se calcula con la MISMA regla que el resto del portal
 * (secciones 14 y 31 del pliego): se excluyen las anuladas y los estados que el
 * catálogo marca como que no cuentan económicamente. Si aquí se usara otra regla,
 * los totales de esta sección no cuadrarían con los del ranking.
 */

export type OrigenVinculo = 'AUTOMATICO' | 'MANUAL';

export type EtiquetaPersona = {
  id: string;
  code: string;
  label: string;
  position: number;
  isActive: boolean;
  isPublic: boolean;
  /** Cuántas personas la llevan. */
  personas: number;
};

export type PersonaResumen = {
  id: string;
  dni: string;
  fullName: string;
  slug: string;
  description: string;
  source: string;
  isPublic: boolean;
  etiquetas: { id: string; label: string }[];
  /** Proveedores vinculados: los deducidos del DNI más los declarados a mano. */
  proveedores: number;
};

export type PersonaDetalle = {
  id: string;
  dni: string;
  fullName: string;
  slug: string;
  description: string;
  source: string;
  /** Enlace a la fuente, si se registró. */
  sourceUrl: string | null;
  /** Cuándo se verificó la fuente y se decidió publicar. */
  verifiedAt: Date | null;
  isPublic: boolean;
  etiquetas: { id: string; code: string; label: string }[];
  vinculosManuales: {
    id: string;
    note: string | null;
    supplierId: string;
    ruc: string;
    nombre: string;
  }[];
};

export type ProveedorVinculado = {
  supplierId: string;
  ruc: string;
  nombre: string;
  slug: string;
  origen: OrigenVinculo;
  nota: string | null;
  ordenes: number;
  /** Monto considerado, como cadena decimal (nunca coma flotante). */
  considerado: string;
};

export type VinculoPorEtiqueta = {
  tagId: string;
  code: string;
  label: string;
  personas: number;
  proveedores: number;
  ordenes: number;
  considerado: string;
};

export type ResumenVinculos = {
  personas: number;
  proveedores: number;
  ordenes: number;
  considerado: string;
};

export type FilaVinculoProveedor = {
  supplierId: string;
  ruc: string;
  nombre: string;
  slug: string;
  ordenes: number;
  considerado: string;
  /** Nombres de las personas que lo señalan. */
  personas: string[];
  /** Las que lo señalan porque su DNI está dentro del RUC. */
  deducidos: string[];
  /** Las que lo señalan por un vínculo declarado a mano. */
  declarados: string[];
};

export type PersonaSenalada = {
  id: string;
  fullName: string;
  slug: string;
  description: string;
  source: string;
  /** Enlace a la fuente, si se registró. */
  sourceUrl: string | null;
  /** Cuándo se verificó la fuente y se decidió publicar. */
  verifiedAt: Date | null;
  /**
   * Si tiene algún vínculo, deducido del RUC o declarado a mano.
   *
   * En el portal solo se publican las fichas con vínculos: una ficha sin ninguno
   * afirmaría algo sobre una persona sin señalar a nadie. En el panel sí se ve, con
   * esta marca, para poder completarla.
   */
  tieneVinculos: boolean;
};

const DNI_VALIDO = /^[0-9]{8}$/;

/** Tope de proveedores que se ofrecen como sugerencia en el formulario. */
const LIMITE_SUGERENCIAS = 500;

// =============================================================================
// Consultas de vínculos
// =============================================================================

/**
 * Genera un slug único a partir del nombre.
 *
 * Igual que con los proveedores, dos personas pueden llamarse igual: el slug es
 * solo para la URL, el identificador real es el DNI.
 */
async function slugUnico(db: ClienteDb, nombre: string, dni: string): Promise<string> {
  const base = slugify(nombre) || `persona-${dni}`;
  let candidato = base;
  let sufijo = 2;

  while (await db.person.findUnique({ where: { slug: candidato }, select: { id: true } })) {
    candidato = `${base}-${sufijo}`;
    sufijo += 1;
  }

  return candidato;
}

/**
 * Etiquetas del catálogo, con cuántas personas lleva cada una.
 *
 * Se muestran también las que no tienen a nadie: son las que se acaban de crear y
 * desaparecer de la lista daría la impresión de que no se guardaron.
 */
export async function listarEtiquetas(
  { incluirInactivas = false }: { incluirInactivas?: boolean } = {},
): Promise<EtiquetaPersona[]> {
  const etiquetas = await prisma.personTag.findMany({
    where: incluirInactivas ? {} : { isActive: true },
    orderBy: [{ position: 'asc' }, { label: 'asc' }],
    select: {
      id: true,
      code: true,
      label: true,
      position: true,
      isActive: true,
      isPublic: true,
      _count: { select: { persons: true } },
    },
  });

  return etiquetas.map((etiqueta) => ({
    id: etiqueta.id,
    code: etiqueta.code,
    label: etiqueta.label,
    position: etiqueta.position,
    isActive: etiqueta.isActive,
    isPublic: etiqueta.isPublic,
    personas: etiqueta._count.persons,
  }));
}

/** Personas registradas, con sus etiquetas y cuántos proveedores tienen detrás. */
export async function listarPersonas(
  { texto = '' }: { texto?: string } = {},
): Promise<PersonaResumen[]> {
  const busqueda = texto.trim();

  const personas = await prisma.person.findMany({
    where:
      busqueda === ''
        ? {}
        : {
            OR: [
              { fullName: { contains: busqueda, mode: 'insensitive' } },
              { dni: { contains: busqueda } },
              { description: { contains: busqueda, mode: 'insensitive' } },
            ],
          },
    orderBy: { fullName: 'asc' },
    select: {
      id: true,
      dni: true,
      fullName: true,
      slug: true,
      description: true,
      source: true,
      isPublic: true,
      tags: { select: { tag: { select: { id: true, label: true } } } },
    },
  });

  // Los proveedores de cada persona, en una sola consulta y no una por fila.
  const conteos = await prisma.$queryRaw<Array<{ personId: string; proveedores: number }>>`
    SELECT v."personId" AS "personId", COUNT(DISTINCT v."supplierId")::int AS proveedores
    FROM (
      SELECT p.id AS "personId", s.id AS "supplierId"
      FROM "Person" p
      JOIN "Supplier" s ON s."rucPrefix" = '10' AND substring(s.ruc FROM 3 FOR 8) = p.dni
      UNION
      SELECT l."personId" AS "personId", l."supplierId" AS "supplierId"
      FROM "PersonSupplierLink" l
    ) v
    GROUP BY v."personId"
  `;

  const porPersona = new Map(conteos.map((fila) => [fila.personId, Number(fila.proveedores)]));

  return personas.map((persona) => ({
    id: persona.id,
    dni: persona.dni,
    fullName: persona.fullName,
    slug: persona.slug,
    description: persona.description,
    source: persona.source,
    isPublic: persona.isPublic,
    etiquetas: persona.tags.map((asignada) => asignada.tag),
    proveedores: porPersona.get(persona.id) ?? 0,
  }));
}

/** Ficha completa de una persona, con sus vínculos manuales. */
export async function personaPorId(id: string): Promise<PersonaDetalle> {
  const persona = await prisma.person.findUnique({
    where: { id },
    select: {
      id: true,
      dni: true,
      fullName: true,
      slug: true,
      description: true,
      source: true,
      sourceUrl: true,
      verifiedAt: true,
      isPublic: true,
      tags: { select: { tag: { select: { id: true, code: true, label: true } } } },
      links: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          note: true,
          supplierId: true,
          supplier: { select: { ruc: true, name: true } },
        },
      },
    },
  });

  if (!persona) throw new NoEncontrado(`No existe la persona ${id}.`);

  return {
    id: persona.id,
    dni: persona.dni,
    fullName: persona.fullName,
    slug: persona.slug,
    description: persona.description,
    source: persona.source,
    sourceUrl: persona.sourceUrl,
    verifiedAt: persona.verifiedAt,
    isPublic: persona.isPublic,
    etiquetas: persona.tags.map((asignada) => asignada.tag),
    vinculosManuales: persona.links.map((enlace) => ({
      id: enlace.id,
      note: enlace.note,
      supplierId: enlace.supplierId,
      ruc: enlace.supplier.ruc,
      nombre: enlace.supplier.name,
    })),
  };
}

/**
 * Proveedores vinculados a una persona, con su gasto.
 *
 * Cuando un proveedor cumple las dos condiciones (el DNI está en su RUC y además
 * hay un vínculo manual) se informa como AUTOMATICO: la coincidencia del documento
 * es la explicación más fuerte.
 */
export async function proveedoresVinculados(personaId: string): Promise<ProveedorVinculado[]> {
  const persona = await prisma.person.findUnique({
    where: { id: personaId },
    select: { dni: true },
  });
  if (!persona) throw new NoEncontrado(`No existe la persona ${personaId}.`);

  const filas = await prisma.$queryRaw<
    Array<{
      supplierId: string;
      ruc: string;
      nombre: string;
      slug: string;
      nota: string | null;
      automatico: boolean;
      ordenes: number;
      considerado: string;
    }>
  >`
    WITH gasto AS (
      SELECT
        o."supplierId" AS "supplierId",
        COUNT(*)::int AS ordenes,
        COALESCE(
          SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true),
          0
        ) AS considerado
      FROM "CurrentOrder" o
      LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
      GROUP BY o."supplierId"
    )
    SELECT
      s.id AS "supplierId",
      s.ruc AS ruc,
      s.name AS nombre,
      s.slug AS slug,
      l.note AS nota,
      (s."rucPrefix" = '10' AND substring(s.ruc FROM 3 FOR 8) = ${persona.dni}) AS automatico,
      COALESCE(g.ordenes, 0)::int AS ordenes,
      COALESCE(g.considerado, 0)::text AS considerado
    FROM "Supplier" s
    LEFT JOIN "PersonSupplierLink" l ON l."supplierId" = s.id AND l."personId" = ${personaId}
    LEFT JOIN gasto g ON g."supplierId" = s.id
    WHERE (s."rucPrefix" = '10' AND substring(s.ruc FROM 3 FOR 8) = ${persona.dni})
       OR l.id IS NOT NULL
    ORDER BY COALESCE(g.considerado, 0) DESC, s.name ASC
  `;

  return filas.map((fila) => ({
    supplierId: fila.supplierId,
    ruc: fila.ruc,
    nombre: fila.nombre,
    slug: fila.slug,
    origen: fila.automatico ? 'AUTOMATICO' : 'MANUAL',
    nota: fila.nota,
    ordenes: Number(fila.ordenes),
    considerado: fila.considerado,
  }));
}

/**
 * Resumen por etiqueta: de aquí sale «cuánto ganan los comunicadores».
 *
 * El dinero se suma sobre proveedores distintos: si un proveedor está vinculado a
 * dos personas de la misma etiqueta, su gasto cuenta una vez y no dos.
 */
export async function vinculosPorEtiqueta(
  { soloPublicas = true }: { soloPublicas?: boolean } = {},
): Promise<VinculoPorEtiqueta[]> {
  const filas = await prisma.$queryRaw<
    Array<{
      tagId: string;
      code: string;
      label: string;
      personas: number;
      proveedores: number;
      ordenes: number;
      considerado: string;
    }>
  >`
    WITH gasto AS (
      SELECT
        o."supplierId" AS "supplierId",
        COUNT(*)::int AS ordenes,
        COALESCE(
          SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true),
          0
        ) AS considerado
      FROM "CurrentOrder" o
      LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
      GROUP BY o."supplierId"
    ),
    vinculos AS (
      -- Deducidos: el RUC de una persona natural lleva el DNI dentro.
      SELECT pt."tagId" AS "tagId", p.id AS "personId", s.id AS "supplierId"
      FROM "Person" p
      JOIN "PersonTagOnPerson" pt ON pt."personId" = p.id
      JOIN "Supplier" s ON s."rucPrefix" = '10' AND substring(s.ruc FROM 3 FOR 8) = p.dni
      WHERE ${soloPublicas} = false OR p."isPublic" = true
      UNION
      -- Declarados a mano por la administración.
      SELECT pt."tagId" AS "tagId", p.id AS "personId", l."supplierId" AS "supplierId"
      FROM "PersonSupplierLink" l
      JOIN "Person" p ON p.id = l."personId"
      JOIN "PersonTagOnPerson" pt ON pt."personId" = p.id
      WHERE ${soloPublicas} = false OR (p."isPublic" = true AND l."sourceUrl" IS NOT NULL AND l."verifiedAt" IS NOT NULL)
    ),
    resumen AS (
      SELECT
        v."tagId" AS "tagId",
        COUNT(DISTINCT v."personId")::int AS personas,
        COUNT(DISTINCT v."supplierId")::int AS proveedores
      FROM vinculos v
      GROUP BY v."tagId"
    ),
    dinero AS (
      SELECT
        v."tagId" AS "tagId",
        COALESCE(SUM(g.ordenes), 0)::int AS ordenes,
        COALESCE(SUM(g.considerado), 0) AS considerado
      FROM (SELECT DISTINCT "tagId", "supplierId" FROM vinculos) v
      LEFT JOIN gasto g ON g."supplierId" = v."supplierId"
      GROUP BY v."tagId"
    )
    SELECT
      t.id AS "tagId",
      t.code AS code,
      t.label AS label,
      COALESCE(r.personas, 0)::int AS personas,
      COALESCE(r.proveedores, 0)::int AS proveedores,
      COALESCE(d.ordenes, 0)::int AS ordenes,
      COALESCE(d.considerado, 0)::text AS considerado
    FROM "PersonTag" t
    LEFT JOIN resumen r ON r."tagId" = t.id
    LEFT JOIN dinero d ON d."tagId" = t.id
    WHERE t."isActive" = true AND (${soloPublicas} = false OR t."isPublic" = true)
    ORDER BY t.position ASC, t.label ASC
  `;

  return filas.map((fila) => ({
    tagId: fila.tagId,
    code: fila.code,
    label: fila.label,
    personas: Number(fila.personas),
    proveedores: Number(fila.proveedores),
    ordenes: Number(fila.ordenes),
    considerado: fila.considerado,
  }));
}

/** Totales de la sección entera, sin contar dos veces un proveedor compartido. */
export async function resumenVinculos(
  { soloPublicas = true }: { soloPublicas?: boolean } = {},
): Promise<ResumenVinculos> {
  const filas = await prisma.$queryRaw<
    Array<{ personas: number; proveedores: number; ordenes: number; considerado: string }>
  >`
    WITH gasto AS (
      SELECT
        o."supplierId" AS "supplierId",
        COUNT(*)::int AS ordenes,
        COALESCE(
          SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true),
          0
        ) AS considerado
      FROM "CurrentOrder" o
      LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
      GROUP BY o."supplierId"
    ),
    vinculos AS (
      SELECT p.id AS "personId", s.id AS "supplierId"
      FROM "Person" p
      JOIN "Supplier" s ON s."rucPrefix" = '10' AND substring(s.ruc FROM 3 FOR 8) = p.dni
      WHERE ${soloPublicas} = false OR p."isPublic" = true
      UNION
      SELECT l."personId" AS "personId", l."supplierId" AS "supplierId"
      FROM "PersonSupplierLink" l
      JOIN "Person" p ON p.id = l."personId"
      WHERE ${soloPublicas} = false OR (p."isPublic" = true AND l."sourceUrl" IS NOT NULL AND l."verifiedAt" IS NOT NULL)
    )
    SELECT
      (SELECT COUNT(DISTINCT "personId") FROM vinculos)::int AS personas,
      COUNT(DISTINCT v."supplierId")::int AS proveedores,
      COALESCE(SUM(g.ordenes), 0)::int AS ordenes,
      COALESCE(SUM(g.considerado), 0)::text AS considerado
    FROM (SELECT DISTINCT "supplierId" FROM vinculos) v
    LEFT JOIN gasto g ON g."supplierId" = v."supplierId"
  `;

  const fila = filas[0];
  return {
    personas: Number(fila?.personas ?? 0),
    proveedores: Number(fila?.proveedores ?? 0),
    ordenes: Number(fila?.ordenes ?? 0),
    considerado: fila?.considerado ?? '0',
  };
}

/**
 * Identificadores de las personas de una etiqueta que tienen al menos un vínculo, sea
 * deducido del RUC o declarado a mano.
 *
 * Se resuelve en SQL porque el vínculo automático NO está guardado: se deduce comparando
 * el DNI con el RUC de las personas naturales, y persistirlo obligaría a resincronizarlo
 * en cada importación.
 */
async function idsDePersonasConVinculo(tagId: string, soloPublicas: boolean): Promise<string[]> {
  const filas = await prisma.$queryRaw<Array<{ personId: string }>>`
    SELECT DISTINCT p.id AS "personId"
    FROM "Person" p
    JOIN "PersonTagOnPerson" pt ON pt."personId" = p.id
    WHERE pt."tagId" = ${tagId}
      AND (${soloPublicas} = false OR p."isPublic" = true)
      AND (
        EXISTS (
          SELECT 1 FROM "Supplier" s
          WHERE s."rucPrefix" = '10' AND substring(s.ruc FROM 3 FOR 8) = p.dni
        )
        OR EXISTS (SELECT 1 FROM "PersonSupplierLink" l WHERE l."personId" = p.id AND (${soloPublicas} = false OR (l."sourceUrl" IS NOT NULL AND l."verifiedAt" IS NOT NULL)))
      )
  `;

  return filas.map((fila) => fila.personId);
}

/**
 * Personas de una etiqueta y proveedores que señalan, con su gasto.
 *
 * En el portal (`soloPublicas`) solo salen las fichas PUBLICADAS y CON VÍNCULO: una ficha
 * sin ningún proveedor afirmaría algo sobre una persona sin señalar a nadie, y eso no se
 * publica. En el panel se piden todas y cada una dice si tiene vínculos, para poder
 * completarla.
 *
 * Cada proveedor distingue quién lo señala por el DNI que lleva dentro su RUC (deducido
 * del dato) y quién por un vínculo que declaró la administración: no es lo mismo y la
 * página pública lo dice.
 */
export async function detalleDeEtiqueta(
  tagId: string,
  { soloPublicas = true }: { soloPublicas?: boolean } = {},
): Promise<{ personas: PersonaSenalada[]; proveedores: FilaVinculoProveedor[] }> {
  const [idsConVinculo, filas] = await Promise.all([
    idsDePersonasConVinculo(tagId, soloPublicas),
    prisma.$queryRaw<
      Array<{
        supplierId: string;
        ruc: string;
        nombre: string;
        slug: string;
        ordenes: number;
        considerado: string;
        personas: string[];
        deducidos: string[];
        declarados: string[];
      }>
    >`
      WITH gasto AS (
        SELECT
          o."supplierId" AS "supplierId",
          COUNT(*)::int AS ordenes,
          COALESCE(
            SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true),
            0
          ) AS considerado
        FROM "CurrentOrder" o
        LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
        GROUP BY o."supplierId"
      ),
      vinculos AS (
        SELECT p.id AS "personId", s.id AS "supplierId", 'deducido' AS origen
        FROM "Person" p
        JOIN "PersonTagOnPerson" pt ON pt."personId" = p.id
        JOIN "Supplier" s ON s."rucPrefix" = '10' AND substring(s.ruc FROM 3 FOR 8) = p.dni
        WHERE pt."tagId" = ${tagId} AND (${soloPublicas} = false OR p."isPublic" = true)
        UNION
        SELECT p.id AS "personId", l."supplierId" AS "supplierId", 'declarado' AS origen
        FROM "PersonSupplierLink" l
        JOIN "Person" p ON p.id = l."personId"
        JOIN "PersonTagOnPerson" pt ON pt."personId" = p.id
        WHERE pt."tagId" = ${tagId} AND (${soloPublicas} = false OR (p."isPublic" = true AND l."sourceUrl" IS NOT NULL AND l."verifiedAt" IS NOT NULL))
      )
      SELECT
        s.id AS "supplierId",
        s.ruc AS ruc,
        s.name AS nombre,
        s.slug AS slug,
        COALESCE(g.ordenes, 0)::int AS ordenes,
        COALESCE(g.considerado, 0)::text AS considerado,
        COALESCE(
          (
            SELECT array_agg(DISTINCT p2."fullName" ORDER BY p2."fullName")
            FROM vinculos v2
            JOIN "Person" p2 ON p2.id = v2."personId"
            WHERE v2."supplierId" = s.id
          ),
          ARRAY[]::text[]
        ) AS personas,
        COALESCE(
          (
            SELECT array_agg(DISTINCT p2."fullName" ORDER BY p2."fullName")
            FROM vinculos v2
            JOIN "Person" p2 ON p2.id = v2."personId"
            WHERE v2."supplierId" = s.id AND v2.origen = 'deducido'
          ),
          ARRAY[]::text[]
        ) AS deducidos,
        COALESCE(
          (
            SELECT array_agg(DISTINCT p2."fullName" ORDER BY p2."fullName")
            FROM vinculos v2
            JOIN "Person" p2 ON p2.id = v2."personId"
            WHERE v2."supplierId" = s.id AND v2.origen = 'declarado'
          ),
          ARRAY[]::text[]
        ) AS declarados
      FROM (SELECT DISTINCT "supplierId" FROM vinculos) v
      JOIN "Supplier" s ON s.id = v."supplierId"
      LEFT JOIN gasto g ON g."supplierId" = s.id
      ORDER BY COALESCE(g.considerado, 0) DESC, s.name ASC
    `,
  ]);

  const conVinculo = new Set(idsConVinculo);

  const personas = await prisma.person.findMany({
    where: {
      tags: { some: { tagId } },
      ...(soloPublicas ? { isPublic: true, id: { in: idsConVinculo } } : {}),
    },
    orderBy: { fullName: 'asc' },
    select: {
      id: true,
      fullName: true,
      slug: true,
      description: true,
      source: true,
      sourceUrl: true,
      verifiedAt: true,
    },
  });

  return {
    personas: personas.map((persona) => ({
      ...persona,
      tieneVinculos: conVinculo.has(persona.id),
    })),
    proveedores: filas.map((fila) => ({
      supplierId: fila.supplierId,
      ruc: fila.ruc,
      nombre: fila.nombre,
      slug: fila.slug,
      ordenes: Number(fila.ordenes),
      considerado: fila.considerado,
      personas: fila.personas,
      deducidos: fila.deducidos,
      declarados: fila.declarados,
    })),
  };
}

/** Proveedores para el selector del formulario de vínculo manual. */
export async function opcionesDeProveedor(): Promise<{ ruc: string; nombre: string }[]> {
  const proveedores = await prisma.supplier.findMany({
    orderBy: { name: 'asc' },
    take: LIMITE_SUGERENCIAS,
    select: { ruc: true, name: true },
  });

  return proveedores.map((proveedor) => ({ ruc: proveedor.ruc, nombre: proveedor.name }));
}

// =============================================================================
// Altas, cambios y bajas
// =============================================================================

export type ContextoAccion = {
  userId: string | null;
  request?: Request;
};

export type EntradaPersona = {
  dni: string;
  fullName: string;
  description: string;
  source: string;
  /** Enlace a la fuente. Cadena vacía si no se registra. */
  sourceUrl: string;
  isPublic: boolean;
  tagIds: string[];
};

function contextoDeAuditoria(accion: ContextoAccion) {
  return accion.request
    ? contextoDePeticion(accion.request)
    : { ip: null, userAgent: null };
}

/**
 * Longitud mínima de la fuente para poder publicar.
 *
 * No es una regla de estilo: lo que se publica aquí es una afirmación sobre una persona
 * real. Una fuente de tres palabras («un acta») no permite comprobar nada, así que una
 * ficha con eso se guarda como borrador, pero no sale al portal.
 */
const MINIMO_FUENTE = 12;

/** Enlace absoluto: sin esquema no hay forma de comprobarlo desde el portal. */
const URL_HTTP = /^https?:\/\/\S+$/i;

/**
 * Comprueba lo que no puede quedar mal y explica por qué.
 *
 * La descripción y la fuente son obligatorias a propósito: esta sección publica
 * afirmaciones sobre personas reales, así que cada ficha tiene que decir qué se
 * afirma y de dónde sale.
 *
 * La fuente se exige con un mínimo de longitud solo al PUBLICAR: una ficha se puede
 * dejar a medias mientras se documenta, sin que salga al portal.
 */
function validarEntradaPersona(entrada: EntradaPersona): EntradaPersona {
  const dni = entrada.dni.trim();
  const fullName = entrada.fullName.trim();
  const description = entrada.description.trim();
  const source = entrada.source.trim();
  const sourceUrl = entrada.sourceUrl.trim();

  if (!DNI_VALIDO.test(dni)) {
    throw new ErrorDeNegocio(
      'El DNI debe tener 8 dígitos exactos, con los ceros a la izquierda si los lleva.',
    );
  }
  if (fullName === '') {
    throw new ErrorDeNegocio('El nombre es obligatorio.');
  }
  if (description === '') {
    throw new ErrorDeNegocio(
      'La descripción es obligatoria: es lo que el portal publica sobre esta persona.',
    );
  }
  if (source === '') {
    throw new ErrorDeNegocio(
      'La fuente es obligatoria: hay que poder decir de dónde sale el vínculo.',
    );
  }
  if (entrada.isPublic && source.length < MINIMO_FUENTE) {
    throw new ErrorDeNegocio(
      `Para publicar la ficha la fuente tiene que ser concreta: al menos ${MINIMO_FUENTE} ` +
        'caracteres, con el documento o el medio del que sale. Sin eso la ficha se guarda, ' +
        'pero no se publica.',
    );
  }
  if (sourceUrl !== '' && !URL_HTTP.test(sourceUrl)) {
    throw new ErrorDeNegocio('El enlace a la fuente tiene que empezar por http:// o https://.');
  }

  return {
    dni,
    fullName,
    description,
    source,
    sourceUrl,
    isPublic: entrada.isPublic,
    tagIds: entrada.tagIds,
  };
}

export async function crearPersona(
  entrada: EntradaPersona,
  accion: ContextoAccion,
): Promise<{ id: string }> {
  const datos = validarEntradaPersona(entrada);

  const duplicada = await prisma.person.findUnique({
    where: { dni: datos.dni },
    select: { id: true },
  });
  if (duplicada) {
    throw new ErrorDeNegocio(`Ya hay una persona registrada con el DNI ${datos.dni}.`);
  }

  const { ip, userAgent } = contextoDeAuditoria(accion);

  return prisma.$transaction(async (tx) => {
    const persona = await tx.person.create({
      data: {
        dni: datos.dni,
        fullName: datos.fullName,
        slug: await slugUnico(tx, datos.fullName, datos.dni),
        description: datos.description,
        source: datos.source,
        sourceUrl: datos.sourceUrl === '' ? null : datos.sourceUrl,
        // La fecha de verificación se sella al publicar: es el momento en el que el
        // administrador asumió la publicación. No se teclea a mano, para que no pueda
        // quedar una fecha que nadie comprobó.
        verifiedAt: datos.isPublic ? new Date() : null,
        isPublic: datos.isPublic,
        createdById: accion.userId,
        tags: { create: datos.tagIds.map((tagId) => ({ tagId })) },
      },
      select: { id: true },
    });

    await registrarAuditoria(tx, {
      userId: accion.userId,
      action: 'CREATE',
      entity: 'Person',
      entityId: persona.id,
      ip,
      userAgent,
      metadata: {
        dni: datos.dni,
        fullName: datos.fullName,
        tagIds: datos.tagIds,
        isPublic: datos.isPublic,
        sourceUrl: datos.sourceUrl === '' ? null : datos.sourceUrl,
      },
    });

    return persona;
  });
}

export async function actualizarPersona(
  id: string,
  entrada: EntradaPersona,
  accion: ContextoAccion,
): Promise<void> {
  const datos = validarEntradaPersona(entrada);

  const existente = await prisma.person.findUnique({
    where: { id },
    select: { dni: true, fullName: true, isPublic: true, verifiedAt: true, description: true, source: true, sourceUrl: true },
  });
  if (!existente) throw new NoEncontrado(`No existe la persona ${id}.`);

  if (datos.dni !== existente.dni) {
    const ocupado = await prisma.person.findUnique({
      where: { dni: datos.dni },
      select: { id: true },
    });
    if (ocupado) {
      throw new ErrorDeNegocio(`Ya hay otra persona registrada con el DNI ${datos.dni}.`);
    }
  }

  const { ip, userAgent } = contextoDeAuditoria(accion);

  await prisma.$transaction(async (tx) => {
    await tx.person.update({
      where: { id },
      data: {
        dni: datos.dni,
        fullName: datos.fullName,
        description: datos.description,
        source: datos.source,
        sourceUrl: datos.sourceUrl === '' ? null : datos.sourceUrl,
        // La revisión editorial se renueva al publicar o cambiar la afirmación/evidencia.
        verifiedAt: !datos.isPublic ? null : !existente.isPublic || existente.description !== datos.description || existente.source !== datos.source || (existente.sourceUrl ?? "") !== datos.sourceUrl ? new Date() : existente.verifiedAt,
        isPublic: datos.isPublic,
        // Las etiquetas se reemplazan enteras: es lo que el formulario envía.
        tags: { deleteMany: {}, create: datos.tagIds.map((tagId) => ({ tagId })) },
      },
    });

    await registrarAuditoria(tx, {
      userId: accion.userId,
      action: 'UPDATE',
      entity: 'Person',
      entityId: id,
      ip,
      userAgent,
      metadata: {
        antes: { dni: existente.dni, fullName: existente.fullName, isPublic: existente.isPublic },
        despues: {
          dni: datos.dni,
          fullName: datos.fullName,
          isPublic: datos.isPublic,
          sourceUrl: datos.sourceUrl === '' ? null : datos.sourceUrl,
        },
        tagIds: datos.tagIds,
      },
    });
  });
}

export async function eliminarPersona(id: string, accion: ContextoAccion): Promise<void> {
  const existente = await prisma.person.findUnique({
    where: { id },
    select: { dni: true, fullName: true },
  });
  if (!existente) throw new NoEncontrado(`No existe la persona ${id}.`);

  const { ip, userAgent } = contextoDeAuditoria(accion);

  await prisma.$transaction(async (tx) => {
    // Etiquetas y vínculos se van con ella (cascada), pero la auditoría queda.
    await tx.person.delete({ where: { id } });

    await registrarAuditoria(tx, {
      userId: accion.userId,
      action: 'DELETE',
      entity: 'Person',
      entityId: id,
      ip,
      userAgent,
      metadata: { dni: existente.dni, fullName: existente.fullName },
    });
  });
}

export type EntradaEtiqueta = {
  code: string;
  label: string;
  position: number;
  isActive: boolean;
  isPublic: boolean;
};

function validarEntradaEtiqueta(entrada: EntradaEtiqueta): EntradaEtiqueta {
  const code = entrada.code.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const label = entrada.label.trim();

  if (code === '') {
    throw new ErrorDeNegocio('El código de la etiqueta es obligatorio (letras y números).');
  }
  if (label === '') {
    throw new ErrorDeNegocio('El nombre de la etiqueta es obligatorio.');
  }

  return { ...entrada, code, label };
}

export async function crearEtiqueta(
  entrada: EntradaEtiqueta,
  accion: ContextoAccion,
): Promise<{ id: string }> {
  const datos = validarEntradaEtiqueta(entrada);

  const duplicada = await prisma.personTag.findUnique({
    where: { code: datos.code },
    select: { id: true },
  });
  if (duplicada) throw new ErrorDeNegocio(`Ya existe una etiqueta con el código ${datos.code}.`);

  const { ip, userAgent } = contextoDeAuditoria(accion);

  return prisma.$transaction(async (tx) => {
    const etiqueta = await tx.personTag.create({
      data: {
        code: datos.code,
        label: datos.label,
        position: datos.position,
        isActive: datos.isActive,
        isPublic: datos.isPublic,
      },
      select: { id: true },
    });

    await registrarAuditoria(tx, {
      userId: accion.userId,
      action: 'CREATE',
      entity: 'PersonTag',
      entityId: etiqueta.id,
      ip,
      userAgent,
      metadata: { code: datos.code, label: datos.label },
    });

    return etiqueta;
  });
}

export async function actualizarEtiqueta(
  id: string,
  entrada: EntradaEtiqueta,
  accion: ContextoAccion,
): Promise<void> {
  const datos = validarEntradaEtiqueta(entrada);

  const existente = await prisma.personTag.findUnique({
    where: { id },
    select: { code: true, label: true },
  });
  if (!existente) throw new NoEncontrado(`No existe la etiqueta ${id}.`);

  if (datos.code !== existente.code) {
    const ocupado = await prisma.personTag.findUnique({
      where: { code: datos.code },
      select: { id: true },
    });
    if (ocupado) throw new ErrorDeNegocio(`Ya existe una etiqueta con el código ${datos.code}.`);
  }

  const { ip, userAgent } = contextoDeAuditoria(accion);

  await prisma.$transaction(async (tx) => {
    await tx.personTag.update({
      where: { id },
      data: {
        code: datos.code,
        label: datos.label,
        position: datos.position,
        isActive: datos.isActive,
        isPublic: datos.isPublic,
      },
    });

    await registrarAuditoria(tx, {
      userId: accion.userId,
      action: 'UPDATE',
      entity: 'PersonTag',
      entityId: id,
      ip,
      userAgent,
      metadata: {
        antes: { code: existente.code, label: existente.label },
        despues: { code: datos.code, label: datos.label },
        isActive: datos.isActive,
        isPublic: datos.isPublic,
      },
    });
  });
}

export async function eliminarEtiqueta(id: string, accion: ContextoAccion): Promise<void> {
  const existente = await prisma.personTag.findUnique({
    where: { id },
    select: { code: true, label: true, _count: { select: { persons: true } } },
  });
  if (!existente) throw new NoEncontrado(`No existe la etiqueta ${id}.`);

  const { ip, userAgent } = contextoDeAuditoria(accion);

  await prisma.$transaction(async (tx) => {
    // Se lleva por delante las asignaciones, no las personas: nadie pierde su ficha
    // por borrar una etiqueta.
    await tx.personTag.delete({ where: { id } });

    await registrarAuditoria(tx, {
      userId: accion.userId,
      action: 'DELETE',
      entity: 'PersonTag',
      entityId: id,
      ip,
      userAgent,
      metadata: {
        code: existente.code,
        label: existente.label,
        personasAfectadas: existente._count.persons,
      },
    });
  });
}

export async function vincularProveedor(
  entrada: { personId: string; ruc: string; note: string | null; sourceUrl?: string; validFrom?: string; validUntil?: string },
  accion: ContextoAccion,
): Promise<{ id: string }> {
  const ruc = entrada.ruc.trim().replace(/[^0-9]/g, '');
  const sourceUrl = entrada.sourceUrl?.trim() || '';
  if (!URL_HTTP.test(sourceUrl) || sourceUrl.length > 500 || (entrada.note?.trim().length ?? 0) < 12) throw new ErrorDeNegocio('Documenta el vínculo con una descripción de al menos 12 caracteres y una URL http(s).');
  const fecha = (v: string | undefined): Date | null => {
    if (!v) return null;
    const d = new Date(v);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(d.getTime()) || d.toISOString().slice(0,10)!==v) throw new ErrorDeNegocio('Fecha de vigencia inválida.');
    return d;
  };
  const validFrom=fecha(entrada.validFrom),validUntil=fecha(entrada.validUntil);
  if (validFrom && validUntil && validUntil < validFrom) throw new ErrorDeNegocio('El fin de vigencia debe ser posterior al inicio.');


  const [persona, proveedor] = await Promise.all([
    prisma.person.findUnique({ where: { id: entrada.personId }, select: { id: true } }),
    prisma.supplier.findUnique({ where: { ruc }, select: { id: true, name: true } }),
  ]);

  if (!persona) throw new NoEncontrado(`No existe la persona ${entrada.personId}.`);
  if (!proveedor) {
    throw new ErrorDeNegocio(
      `No hay ningún proveedor con el RUC ${ruc || '(vacío)'}. Comprueba el número en la lista de proveedores.`,
    );
  }

  const repetido = await prisma.personSupplierLink.findUnique({
    where: { personId_supplierId: { personId: persona.id, supplierId: proveedor.id } },
    select: { id: true },
  });
  if (repetido) {
    throw new ErrorDeNegocio(`«${proveedor.name}» ya está vinculado a esta persona.`);
  }

  const { ip, userAgent } = contextoDeAuditoria(accion);

  return prisma.$transaction(async (tx) => {
    const enlace = await tx.personSupplierLink.create({
      data: {
        personId: persona.id,
        supplierId: proveedor.id,
        note: entrada.note?.trim() || null,
        sourceUrl, validFrom, validUntil, verifiedAt: new Date(),
        createdById: accion.userId,
      },
      select: { id: true },
    });

    await registrarAuditoria(tx, {
      userId: accion.userId,
      action: 'CREATE',
      entity: 'PersonSupplierLink',
      entityId: enlace.id,
      ip,
      userAgent,
      metadata: { personId: persona.id, ruc, supplierName: proveedor.name },
    });

    return enlace;
  });
}

export async function desvincularProveedor(linkId: string, accion: ContextoAccion): Promise<void> {
  const enlace = await prisma.personSupplierLink.findUnique({
    where: { id: linkId },
    select: { id: true, personId: true, supplier: { select: { ruc: true, name: true } } },
  });
  if (!enlace) throw new NoEncontrado(`No existe el vínculo ${linkId}.`);

  const { ip, userAgent } = contextoDeAuditoria(accion);

  await prisma.$transaction(async (tx) => {
    await tx.personSupplierLink.delete({ where: { id: linkId } });

    await registrarAuditoria(tx, {
      userId: accion.userId,
      action: 'DELETE',
      entity: 'PersonSupplierLink',
      entityId: linkId,
      ip,
      userAgent,
      metadata: {
        personId: enlace.personId,
        ruc: enlace.supplier.ruc,
        supplierName: enlace.supplier.name,
      },
    });
  });
}
