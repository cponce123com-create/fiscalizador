import 'dotenv/config';

import { prisma } from '../lib/prisma';

/**
 * Lista las cuentas del sistema.
 *
 * Existe porque la Fase 3 entregó autenticación con roles pero no una pantalla de
 * gestión de usuarios: crear, listar o desactivar cuentas se hace desde aquí
 * hasta que se construya esa pantalla.
 *
 * Uso:  npx tsx scripts/listar-usuarios.ts
 *
 * Nunca imprime el hash de la contraseña completo, solo si está definido.
 */

async function main(): Promise<void> {
  const usuarios = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { email: 'asc' }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      passwordHash: true,
      _count: { select: { sessions: true, importBatches: true } },
    },
  });

  if (usuarios.length === 0) {
    console.log('No hay usuarios. Ejecuta `npm run db:seed` para crear el primero.');
    return;
  }

  console.log('');
  console.log('CUENTAS DEL SISTEMA: ' + usuarios.length);
  console.log('='.repeat(72));

  for (const usuario of usuarios) {
    console.log('');
    console.log('  correo        : ' + usuario.email);
    console.log('  nombre        : ' + (usuario.name ?? '(sin nombre)'));
    console.log('  rol           : ' + usuario.role);
    console.log('  activa        : ' + (usuario.isActive ? 'sí' : 'NO — no puede iniciar sesión'));
    console.log('  contraseña    : ' + (usuario.passwordHash ? 'definida' : 'SIN DEFINIR — no puede iniciar sesión'));
    console.log('  último acceso : ' + (usuario.lastLoginAt ? usuario.lastLoginAt.toISOString() : 'nunca'));
    console.log('  importaciones : ' + usuario._count.importBatches);
  }

  console.log('');
  console.log('='.repeat(72));

  const inactivas = usuarios.filter((u) => !u.isActive || !u.passwordHash);
  if (inactivas.length > 0) {
    console.log('AVISO: ' + inactivas.length + ' cuenta(s) no pueden iniciar sesión.');
  }
}

main()
  .catch((error) => {
    console.error('Falló el listado:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
