import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { generarCodigo } from '@/lib/auth/totp';
import { prisma } from '@/lib/prisma';
import {
  CODIGOS_DE_RECUPERACION,
  activar,
  desactivar,
  exigeSegundoFactor,
  generarCodigosDeRecuperacion,
  hashDeCodigo,
  iniciarAlta,
  verificarSegundoFactor,
} from '@/services/twoFactorService';

/**
 * Pruebas del segundo factor.
 *
 * Las piezas puras se prueban siempre; el alta y la verificación necesitan base de datos,
 * así que se saltan sin `DATABASE_URL`. El usuario de prueba se crea y se borra aquí: no
 * se toca ninguna cuenta real.
 */

const hayBaseDeDatos = Boolean(process.env.DATABASE_URL);

describe('piezas puras', () => {
  it('exige el segundo factor a los roles administrativos', () => {
    expect(exigeSegundoFactor('SUPERADMIN')).toBe(true);
    expect(exigeSegundoFactor('ADMIN')).toBe(true);
    expect(exigeSegundoFactor('EDITOR')).toBe(false);
    expect(exigeSegundoFactor('VIEWER')).toBe(false);
  });

  it('genera códigos de recuperación con el formato esperado y sin repetirlos', () => {
    const codigos = generarCodigosDeRecuperacion();

    expect(codigos).toHaveLength(CODIGOS_DE_RECUPERACION);
    expect(new Set(codigos).size).toBe(codigos.length);

    for (const codigo of codigos) {
      expect(codigo).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}-[0-9A-F]{4}$/);
    }
  });

  it('el hash ignora guiones, espacios y mayúsculas', () => {
    expect(hashDeCodigo('ABCDE-FGHIJ-KLMN')).toBe(hashDeCodigo('abcde fghij klmn'));
  });

  it('iniciarAlta devuelve un secreto y una URL coherentes', () => {
    const { secreto, url } = iniciarAlta('admin@example.org');

    expect(secreto).toHaveLength(32);
    expect(url.startsWith('otpauth://totp/')).toBe(true);
    expect(url).toContain(`secret=${secreto}`);
  });
});

describe.skipIf(!hayBaseDeDatos)('alta y verificación contra la base real', () => {
  let usuarioId = '';
  let secreto = '';
  let codigos: string[] = [];

  beforeAll(async () => {
    const usuario = await prisma.user.create({
      data: { email: `prueba-2fa-${Date.now()}@example.org`, role: 'ADMIN', isActive: true },
      select: { id: true },
    });

    usuarioId = usuario.id;
    ({ secreto } = iniciarAlta('admin@example.org'));
    codigos = await activar(prisma, usuarioId, secreto, generarCodigo(secreto));
  });

  afterAll(async () => {
    if (usuarioId) {
      await prisma.user.delete({ where: { id: usuarioId } }).catch(() => undefined);
    }
  });

  it('guarda el secreto cifrado y habilita el segundo factor', async () => {
    const guardado = await prisma.user.findUnique({
      where: { id: usuarioId },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    });

    expect(guardado?.twoFactorEnabled).toBe(true);
    expect(guardado?.twoFactorSecret).not.toBe(secreto);
    expect(guardado?.twoFactorSecret).not.toContain(secreto);
  });

  it('crea los códigos de recuperación sin usar', async () => {
    const filas = await prisma.twoFactorRecoveryCode.findMany({ where: { userId: usuarioId } });

    expect(filas).toHaveLength(CODIGOS_DE_RECUPERACION);
    expect(filas.every((fila) => fila.usedAt === null)).toBe(true);
    // Los códigos en claro no se guardan.
    for (const fila of filas) {
      expect(codigos).not.toContain(fila.codeHash);
    }
  });

  it('rechaza un código que no cuadra', async () => {
    const guardado = await prisma.user.findUnique({
      where: { id: usuarioId },
      select: { id: true, twoFactorSecret: true },
    });

    expect(await verificarSegundoFactor(prisma, guardado!, '000000')).toBe(false);
  });

  it('acepta el código TOTP del momento', async () => {
    const guardado = await prisma.user.findUnique({
      where: { id: usuarioId },
      select: { id: true, twoFactorSecret: true },
    });

    expect(await verificarSegundoFactor(prisma, guardado!, generarCodigo(secreto))).toBe(true);
  });

  it('acepta un código de recuperación y solo una vez', async () => {
    const guardado = await prisma.user.findUnique({
      where: { id: usuarioId },
      select: { id: true, twoFactorSecret: true },
    });

    expect(await verificarSegundoFactor(prisma, guardado!, codigos[0]!)).toBe(true);
    // El mismo código, otra vez: ya está gastado.
    expect(await verificarSegundoFactor(prisma, guardado!, codigos[0]!)).toBe(false);
    // Otro código sigue sirviendo.
    expect(await verificarSegundoFactor(prisma, guardado!, codigos[1]!)).toBe(true);
  });

  it('no acepta el código de recuperación de otra cuenta', async () => {
    const otro = await prisma.user.create({
      data: { email: `prueba-2fa-otro-${Date.now()}@example.org`, role: 'ADMIN', isActive: true },
      select: { id: true },
    });

    try {
      const { secreto: secretoAjeno } = iniciarAlta('otro@example.org');
      await activar(prisma, otro.id, secretoAjeno, generarCodigo(secretoAjeno));

      const codigosAjenos = generarCodigosDeRecuperacion();
      await prisma.twoFactorRecoveryCode.create({
        data: { userId: otro.id, codeHash: hashDeCodigo(codigosAjenos[0]!) },
      });

      const guardado = await prisma.user.findUnique({
        where: { id: usuarioId },
        select: { id: true, twoFactorSecret: true },
      });

      expect(await verificarSegundoFactor(prisma, guardado!, codigosAjenos[0]!)).toBe(false);
    } finally {
      await prisma.user.delete({ where: { id: otro.id } }).catch(() => undefined);
    }
  });

  it('desactivar borra el secreto y los códigos', async () => {
    await desactivar(prisma, usuarioId);

    const guardado = await prisma.user.findUnique({
      where: { id: usuarioId },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    });

    expect(guardado?.twoFactorEnabled).toBe(false);
    expect(guardado?.twoFactorSecret).toBeNull();
    expect(await prisma.twoFactorRecoveryCode.count({ where: { userId: usuarioId } })).toBe(0);
  });
});
