import 'dotenv/config';

import { prisma } from '../lib/prisma';
import { hashearPassword, validarFortaleza } from '../lib/auth/passwords';
import type { Role } from '@/lib/auth/permissions';
import { desactivar as desactivarSegundoFactor } from '../services/twoFactorService';

/**
 * Crea, actualiza, desactiva o elimina una cuenta del sistema.
 *
 * Hace falta porque las variables `SEED_SUPERADMIN_*` solo las lee `prisma/seed.ts`,
 * y ese script NO cambia la contraseña de un usuario que ya existe (a propósito,
 * para que reejecutarlo no resetee la contraseña de un administrador). Cambiar esas
 * variables no tiene ningún efecto sobre una cuenta ya creada: hay que cambiarla
 * aquí.
 *
 * Uso:
 *   NUEVA_PASSWORD="..." npm run usuarios -- --email admin@example.com
 *
 *   npm run usuarios -- --email revisor@entidad.gob.pe --rol VIEWER --crear
 *   npm run usuarios -- --email alguien@entidad.gob.pe --desactivar
 *   npm run usuarios -- --email prueba@example.com --eliminar
 *   npm run usuarios -- --email admin@example.com --reset-2fa
 *   npm run usuarios -- --email admin@example.com --exigir-cambio
 *
 * La contraseña se lee de la variable de entorno `NUEVA_PASSWORD` y no de un
 * argumento, para que no quede en el historial del shell ni en la lista de
 * procesos. Si se pasa `--password`, funciona, pero avisa.
 */

const ROLES_VALIDOS: readonly Role[] = ['SUPERADMIN', 'ADMIN', 'EDITOR', 'VIEWER'];

type Argumentos = {
  email: string;
  password: string | null;
  passwordPorArgumento: boolean;
  exigirCambio: boolean;
  rol: Role | null;
  nombre: string | null;
  crear: boolean;
  desactivar: boolean;
  eliminar: boolean;
  /** Salida de emergencia del segundo factor: se perdió el teléfono y los códigos. */
  reset2fa: boolean;
};

function analizarArgumentos(argv: readonly string[]): Argumentos {
  const desdeEnv = argv.includes('--desde-env');

  const obtener = (bandera: string): string | null => {
    const indice = argv.indexOf(bandera);
    if (indice === -1) return null;
    return argv[indice + 1] ?? null;
  };

  // Con `--desde-env` el correo y la contraseña salen de `.env`
  // (SEED_SUPERADMIN_EMAIL y SEED_SUPERADMIN_PASSWORD). Es el modo pensado para
  // quien acaba de editar esas variables: un solo comando y quedan aplicadas.
  const email = desdeEnv ? (process.env.SEED_SUPERADMIN_EMAIL ?? null) : obtener('--email');

  if (!email) {
    const lineas = desdeEnv
      ? [
          'Falta SEED_SUPERADMIN_EMAIL en el archivo .env.',
          '',
          'Añádela y vuelve a ejecutar el comando.',
        ]
      : [
          'Falta --email.',
          '',
          'Ejemplo:',
          '  NUEVA_PASSWORD="..." npm run usuarios -- --email admin@example.com',
        ];

    throw new Error(lineas.join(String.fromCharCode(10)));
  }

  const passwordArgumento = obtener('--password');
  const rol = obtener('--rol');

  if (rol && !ROLES_VALIDOS.includes(rol as Role)) {
    throw new Error(`Rol inválido: "${rol}". Válidos: ${ROLES_VALIDOS.join(', ')}.`);
  }

  return {
    email: email.trim().toLowerCase(),
    password: desdeEnv
      ? (process.env.SEED_SUPERADMIN_PASSWORD ?? null)
      : (passwordArgumento ?? process.env.NUEVA_PASSWORD ?? null),
    passwordPorArgumento: Boolean(passwordArgumento),
    // El propósito de `--desde-env` es que esas credenciales funcionen, así que
    // la cuenta se crea si no existe y es superadministradora por defecto.
    rol: (rol as Role | null) ?? (desdeEnv ? 'SUPERADMIN' : null),
    nombre: obtener('--nombre'),
    crear: argv.includes('--crear') || desdeEnv,
    desactivar: argv.includes('--desactivar'),
    eliminar: argv.includes('--eliminar'),
    reset2fa: argv.includes('--reset-2fa'),
    exigirCambio: argv.includes('--exigir-cambio'),
  };
}

async function main(): Promise<void> {
  const args = analizarArgumentos(process.argv.slice(2));

  const existente = await prisma.user.findUnique({
    where: { email: args.email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      twoFactorEnabled: true,
      _count: { select: { importBatches: true, sessions: true } },
    },
  });

  // --- Reiniciar el segundo factor (salida de emergencia) --------------------
  // Va antes que todo lo demás, y no pide contraseña: quien lo necesita es alguien
  // que ha perdido el teléfono y los códigos de recuperación y no puede entrar.
  if (args.reset2fa) {
    if (!existente) throw new Error(`No existe la cuenta ${args.email}.`);

    await desactivarSegundoFactor(prisma, existente.id);
    // Se cierran sus sesiones: si el alta anterior estaba en manos de otro, se corta.
    const cerradas = await prisma.session.deleteMany({ where: { userId: existente.id } });

    console.log('');
    console.log('Verificación en dos pasos desactivada: ' + existente.email);
    console.log('  estaba activada : ' + (existente.twoFactorEnabled ? 'sí' : 'no'));
    console.log('  sesiones persistidas eliminadas: ' + cerradas.count);
    console.log('  todas las sesiones JWT anteriores quedaron revocadas.');
    console.log('');
    console.log('La cuenta tendrá que darla de alta otra vez al entrar.');
    console.log('Úsalo solo si se ha perdido el teléfono y los códigos de recuperación.');
    console.log('');
    return;
  }

  // --- Desactivar una cuenta -------------------------------------------------
  if (args.desactivar) {
    if (!existente) throw new Error(`No existe la cuenta ${args.email}.`);

    await prisma.user.update({ where: { id: existente.id }, data: { isActive: false, sessionVersion: { increment: 1 } } });
    // Se cierran sus sesiones para que el cambio surta efecto de inmediato.
    await prisma.session.deleteMany({ where: { userId: existente.id } });

    console.log('');
    console.log('Cuenta desactivada: ' + args.email);
    console.log('Sus sesiones abiertas se cerraron.');
    console.log('La cuenta y su historial se conservan: se puede reactivar cuando haga falta.');
    console.log('');
    return;
  }

  // --- Eliminar una cuenta ---------------------------------------------------
  if (args.eliminar) {
    if (!existente) throw new Error(`No existe la cuenta ${args.email}.`);

    // Una cuenta que ha hecho trabajo no se borra. Eliminarla dejaría las
    // importaciones y la auditoría sin autor, y el proyecto exige trazabilidad.
    if (existente._count.importBatches > 0) {
      throw new Error(
        [
          `La cuenta ${args.email} tiene ${existente._count.importBatches} importación(es) registrada(s).`,
          'No se elimina, para no dejar la auditoría sin autor. Desactívala:',
          '',
          `  npm run usuarios -- --email ${args.email} --desactivar`,
        ].join(String.fromCharCode(10)),
      );
    }

    await prisma.user.delete({ where: { id: existente.id } });

    console.log('');
    console.log('Cuenta eliminada: ' + args.email);
    console.log('No tenía importaciones registradas, así que no deja auditoría huérfana.');
    console.log('');
    return;
  }

  // --- La cuenta no existe ---------------------------------------------------
  if (!existente && !args.crear) {
    console.log('');
    console.log(`No existe ninguna cuenta con el correo ${args.email}.`);
    console.log('');
    console.log('Si quieres crearla, añade --crear. Por ejemplo:');
    console.log('');
    console.log(
      `  NUEVA_PASSWORD="..." npm run usuarios -- --email ${args.email} --rol ADMIN --crear`,
    );
    console.log('');
    return;
  }

  // --- Exigir el cambio sin tocar la contraseña ------------------------------
  //
  // Para la cuenta que ya existe y cuya contraseña se compartió en claro: hay que
  // forzar el cambio, pero sin inventarle una nueva, que también habría que
  // comunicar y tendría el mismo problema.
  if (args.exigirCambio) {
    if (!existente) throw new Error(`No existe la cuenta ${args.email}.`);

    await prisma.user.update({
      where: { id: existente.id },
      data: { mustChangePassword: true, sessionVersion: { increment: 1 } },
    });

    console.log('');
    console.log('Cambio de contraseña exigido: ' + existente.email);
    console.log('Su contraseña actual sigue sirviendo para entrar y cambiarla,');
    console.log('pero el panel no se abre hasta que la cambie.');
    console.log('');
    return;
  }

  if (!args.password) {
    const ejemplo = `NUEVA_PASSWORD="..." npm run usuarios -- --email ${args.email}`;

    throw new Error(
      [
        'Falta la contraseña.',
        'Pásala en la variable de entorno NUEVA_PASSWORD, que no queda en el historial del shell:',
        '',
        '  ' + ejemplo,
      ].join(String.fromCharCode(10)),
    );
  }

  const fortaleza = validarFortaleza(args.password);
  if (!fortaleza.ok) throw new Error(fortaleza.motivo);

  if (args.passwordPorArgumento) {
    console.log('');
    console.log('AVISO: has pasado la contraseña con --password, así que ha quedado');
    console.log('en el historial del shell y en la lista de procesos. Cámbiala con');
    console.log('NUEVA_PASSWORD la próxima vez.');
  }

  const passwordHash = await hashearPassword(args.password);

  // --- Crear ----------------------------------------------------------------
  if (!existente) {
    const creado = await prisma.user.create({
      data: {
        email: args.email,
        name: args.nombre ?? args.email.split('@')[0] ?? 'Usuario',
        passwordHash,
        role: args.rol ?? 'VIEWER',
        isActive: true,
        // La contraseña la ha tecleado quien ejecuta el script, así que la conoce
        // alguien más que su dueño: la cuenta nace obligada a cambiarla.
        mustChangePassword: true,
      },
      select: { email: true, role: true },
    });

    console.log('');
    console.log('Cuenta creada.');
    console.log('  correo : ' + creado.email);
    console.log('  rol    : ' + creado.role);
    console.log('  al entrar, la cuenta tendrá que cambiar la contraseña.');
    console.log('');
    return;
  }

  // --- Actualizar -----------------------------------------------------------
  const cambios: {
    passwordHash: string;
    sessionVersion: { increment: number };
    role?: Role;
    name?: string;
    isActive?: boolean;
    mustChangePassword?: boolean;
  } = {
    passwordHash,
    sessionVersion: { increment: 1 },
    isActive: true,
    // Igual que al crear: la contraseña la conoce quien la ha tecleado aquí.
    mustChangePassword: true,
  };
  if (args.rol) cambios.role = args.rol;
  if (args.nombre) cambios.name = args.nombre;

  await prisma.user.update({ where: { id: existente.id }, data: cambios });

  // Al cambiar la contraseña se cierran las sesiones abiertas: si alguien tenía
  // acceso, deja de tenerlo con la contraseña anterior.
  const cerradas = await prisma.session.deleteMany({ where: { userId: existente.id } });

  console.log('');
  console.log('Cuenta actualizada.');
  console.log('  correo           : ' + existente.email);
  console.log('  rol anterior     : ' + existente.role);
  console.log('  rol actual       : ' + (args.rol ?? existente.role));
  console.log('  contraseña       : cambiada (la cuenta deberá cambiarla al entrar)');
  console.log('  sesiones persistidas eliminadas: ' + cerradas.count);
  console.log('  todas las sesiones JWT anteriores quedaron revocadas.');
  console.log('');
}

main()
  .catch((error) => {
    console.error('');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
