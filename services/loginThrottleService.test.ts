import { afterAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Pruebas del limitador de intentos contra la base real.
 *
 * Comprueban lo que no se ve a simple vista: que el umbral se alcanza justo a los
 * cinco fallos, que un inicio correcto limpia el contador y que una ventana
 * caducada vuelve a empezar de cero. Todo lo que crean lo borran después.
 */

const hayBaseDeDatos = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hayBaseDeDatos)('loginThrottleService contra la base real', () => {
  let svc: typeof import('@/services/loginThrottleService');
  let prisma: typeof import('@/lib/prisma').prisma;

  // Claves únicas por ejecución: no chocan con datos reales ni con otras corridas.
  const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `test-throttle-${sufijo}@example.org`;
  const ip = `192.0.2.${Math.floor(Math.random() * 200) + 1}`;

  const filtro = () => ({
    OR: [
      { scope: 'EMAIL' as const, key: email },
      { scope: 'IP' as const, key: ip },
    ],
  });

  async function limpiar(): Promise<void> {
    await prisma.loginAttempt.deleteMany({ where: filtro() });
  }

  beforeEach(async () => {
    svc = await import('@/services/loginThrottleService');
    ({ prisma } = await import('@/lib/prisma'));
    await limpiar();
  });

  afterAll(async () => {
    if (prisma) await limpiar();
  });

  it('no bloquea antes de alcanzar el umbral', async () => {
    expect(await svc.estaBloqueado(prisma, { email, ip })).toBe(false);

    for (let i = 1; i < svc.MAX_FALLOS; i++) {
      expect(await svc.registrarFallo(prisma, { email, ip })).toBe(false);
    }

    expect(await svc.estaBloqueado(prisma, { email, ip })).toBe(false);
  });

  it('bloquea al alcanzar el umbral', async () => {
    for (let i = 1; i < svc.MAX_FALLOS; i++) {
      await svc.registrarFallo(prisma, { email, ip });
    }

    expect(await svc.registrarFallo(prisma, { email, ip })).toBe(true);
    expect(await svc.estaBloqueado(prisma, { email, ip })).toBe(true);
  });

  it('un inicio correcto limpia el contador', async () => {
    for (let i = 0; i < svc.MAX_FALLOS; i++) {
      await svc.registrarFallo(prisma, { email, ip });
    }
    expect(await svc.estaBloqueado(prisma, { email, ip })).toBe(true);

    await svc.registrarExito(prisma, { email, ip });

    expect(await svc.estaBloqueado(prisma, { email, ip })).toBe(false);
    expect(await prisma.loginAttempt.findMany({ where: filtro() })).toHaveLength(0);
  });

  it('una ventana caducada reinicia el conteo', async () => {
    for (let i = 0; i < svc.MAX_FALLOS - 1; i++) {
      await svc.registrarFallo(prisma, { email, ip });
    }

    // Retrasa el inicio de la ventana más allá del límite, como si los fallos
    // fueran de hace media hora.
    await prisma.loginAttempt.updateMany({
      where: filtro(),
      data: { windowStartedAt: new Date(Date.now() - svc.VENTANA_MS - 1000) },
    });

    expect(await svc.registrarFallo(prisma, { email, ip })).toBe(false);
    expect(await svc.estaBloqueado(prisma, { email, ip })).toBe(false);
  });

  it('sin IP solo cuenta el correo', async () => {
    for (let i = 0; i < svc.MAX_FALLOS; i++) {
      await svc.registrarFallo(prisma, { email, ip: null });
    }

    const filas = await prisma.loginAttempt.findMany({ where: { key: email } });
    expect(filas).toHaveLength(1);
    expect(filas[0]?.scope).toBe('EMAIL');
  });
});
