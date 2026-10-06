import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { hashearPassword, verificarPassword } from '@/lib/auth/passwords';

/**
 * Pruebas del cambio de contraseña contra la base real.
 *
 * Lo que se comprueba es que la marca `mustChangePassword` se levanta al cambiarla y que
 * **no se levanta cuando el cambio se rechaza**: si un intento fallido la limpiara, la
 * cuenta quedaría con la contraseña que se compartió en claro y con el panel abierto, que
 * es exactamente lo contrario de lo que se busca.
 */

const hayBaseDeDatos = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hayBaseDeDatos)('cambiarPassword contra la base real', () => {
  let svc: typeof import('@/services/passwordService');
  let prisma: typeof import('@/lib/prisma').prisma;

  const EMAIL = 'prueba-password@example.invalid';
  const EMAIL_SIN_PASSWORD = 'prueba-password-sin-hash@example.invalid';
  const ACTUAL = 'contrasena-de-prueba-1';
  const NUEVA = 'contrasena-de-prueba-2';

  let id: string;
  let idSinPassword: string;

  async function estado(usuarioId: string) {
    return prisma.user.findUniqueOrThrow({
      where: { id: usuarioId },
      select: { mustChangePassword: true, passwordHash: true },
    });
  }

  beforeAll(async () => {
    svc = await import('@/services/passwordService');
    ({ prisma } = await import('@/lib/prisma'));

    // Restos de una corrida que se cortó antes de limpiar.
    await prisma.user.deleteMany({ where: { email: { in: [EMAIL, EMAIL_SIN_PASSWORD] } } });

    const creado = await prisma.user.create({
      data: {
        email: EMAIL,
        name: 'Prueba de contraseña',
        passwordHash: await hashearPassword(ACTUAL),
        role: 'EDITOR',
        mustChangePassword: true,
      },
      select: { id: true },
    });
    id = creado.id;

    const sinPassword = await prisma.user.create({
      data: {
        email: EMAIL_SIN_PASSWORD,
        name: 'Prueba sin contraseña',
        role: 'VIEWER',
        mustChangePassword: true,
      },
      select: { id: true },
    });
    idSinPassword = sinPassword.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [EMAIL, EMAIL_SIN_PASSWORD] } } });
  });

  it('avisa si la cuenta no tiene contraseña, en lugar de reventar', async () => {
    await expect(
      svc.cambiarPassword(prisma, { userId: idSinPassword, actual: ACTUAL, nueva: NUEVA }),
    ).rejects.toThrow(/no tiene contraseña/);
  });

  it('avisa si la cuenta no existe', async () => {
    await expect(
      svc.cambiarPassword(prisma, { userId: 'no-existe', actual: ACTUAL, nueva: NUEVA }),
    ).rejects.toThrow(/no existe/);
  });

  it('rechaza la contraseña actual equivocada', async () => {
    await expect(
      svc.cambiarPassword(prisma, { userId: id, actual: 'no-es-la-buena', nueva: NUEVA }),
    ).rejects.toThrow(/actual no es correcta/);
  });

  it('rechaza una contraseña nueva demasiado corta', async () => {
    await expect(
      svc.cambiarPassword(prisma, { userId: id, actual: ACTUAL, nueva: 'corta' }),
    ).rejects.toThrow(/al menos 12/);
  });

  it('rechaza repetir la misma contraseña', async () => {
    await expect(
      svc.cambiarPassword(prisma, { userId: id, actual: ACTUAL, nueva: ACTUAL }),
    ).rejects.toThrow(/distinta de la actual/);
  });

  it('no levanta la marca cuando el cambio se rechaza', async () => {
    // Los cuatro rechazos de arriba ya han pasado; si alguno hubiera escrito, aquí se
    // vería: la marca sigue puesta y la contraseña sigue siendo la de antes.
    const antes = await estado(id);

    expect(antes.mustChangePassword).toBe(true);
    expect(await verificarPassword(antes.passwordHash ?? '', ACTUAL)).toBe(true);
    expect(await verificarPassword(antes.passwordHash ?? '', NUEVA)).toBe(false);
  });

  it('cambia la contraseña y levanta la marca', async () => {
    await svc.cambiarPassword(prisma, { userId: id, actual: ACTUAL, nueva: NUEVA });

    const despues = await estado(id);

    expect(despues.mustChangePassword).toBe(false);
    expect(await verificarPassword(despues.passwordHash ?? '', NUEVA)).toBe(true);
    // La anterior deja de servir.
    expect(await verificarPassword(despues.passwordHash ?? '', ACTUAL)).toBe(false);
  });

  it('deja cambiar otra vez con la contraseña nueva', async () => {
    const tercera = 'contrasena-de-prueba-3';

    await svc.cambiarPassword(prisma, { userId: id, actual: NUEVA, nueva: tercera });

    const despues = await estado(id);
    expect(await verificarPassword(despues.passwordHash ?? '', tercera)).toBe(true);
  });
});
