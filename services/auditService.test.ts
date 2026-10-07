import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { contextoDePeticion, registrarAuditoria } from '@/services/auditService';

/**
 * Pruebas de la auditoría.
 *
 * `contextoDePeticion` es pura y se prueba siempre: de ella dependen la IP que queda en
 * el rastro y la clave por IP del limitador de intentos, así que conviene tener claro qué
 * hace con cada forma de `x-forwarded-for`. `registrarAuditoria` escribe en la base, así
 * que su prueba es de integración y se salta sin `DATABASE_URL`.
 */

const hayBaseDeDatos = process.env.INTEGRATION_TESTS_ENABLED === '1';

/** Petición mínima con las cabeceras dadas. */
function peticion(cabeceras: Record<string, string>): Request {
  return new Request('https://portal.test/', { headers: cabeceras });
}

describe('contextoDePeticion', () => {
  beforeEach(() => vi.stubEnv('TRUSTED_PROXY_HOPS', '1'));
  afterEach(() => vi.unstubAllEnvs());
  it('selecciona desde la derecha según la cadena de proxies configurada', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '2');
    const { ip } = contextoDePeticion(peticion({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }));

    expect(ip).toBe('203.0.113.7');
  });

  it('no confía en cabeceras sin configuración ni en direcciones inventadas', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '0');
    expect(contextoDePeticion(peticion({ 'x-forwarded-for': '203.0.113.7' })).ip).toBeNull();
    vi.stubEnv('TRUSTED_PROXY_HOPS', '1');
    expect(contextoDePeticion(peticion({ 'x-forwarded-for': '203.0.113.7, no-es-ip' })).ip).toBeNull();
    expect(contextoDePeticion(peticion({ 'x-forwarded-for': 'IP-inventada, 203.0.113.8' })).ip).toBe('203.0.113.8');
  });
  it('recorta los espacios de la IP', () => {
    expect(contextoDePeticion(peticion({ 'x-forwarded-for': '  203.0.113.7  ' })).ip).toBe(
      '203.0.113.7',
    );
  });

  it('sin la cabecera, no hay IP', () => {
    expect(contextoDePeticion(peticion({})).ip).toBeNull();
  });

  it('con la cabecera en blanco, no hay IP', () => {
    expect(contextoDePeticion(peticion({ 'x-forwarded-for': '   ' })).ip).toBeNull();
  });

  it('devuelve el user-agent tal cual', () => {
    const { userAgent } = contextoDePeticion(peticion({ 'user-agent': 'Mozilla/5.0 (prueba)' }));

    expect(userAgent).toBe('Mozilla/5.0 (prueba)');
  });

  it('sin user-agent, devuelve null', () => {
    expect(contextoDePeticion(peticion({})).userAgent).toBeNull();
  });
});

describe.skipIf(!hayBaseDeDatos)('registrarAuditoria contra la base real', () => {
  let prisma: typeof import('@/lib/prisma').prisma;

  // Marca única por ejecución: identifica las filas de esta prueba y permite borrarlas.
  const marca = `prueba-auditoria-${Date.now()}`;

  afterAll(async () => {
    if (prisma) await prisma.auditLog.deleteMany({ where: { entityId: marca } });
  });

  it('escribe la entrada normalizando los valores ausentes a null', async () => {
    ({ prisma } = await import('@/lib/prisma'));

    await registrarAuditoria(prisma, {
      action: 'UPDATE',
      entity: 'ImportBatch',
      entityId: marca,
      metadata: { prueba: true },
    });

    const fila = await prisma.auditLog.findFirst({ where: { entityId: marca } });

    expect(fila).not.toBeNull();
    expect(fila?.action).toBe('UPDATE');
    expect(fila?.entity).toBe('ImportBatch');
    expect(fila?.userId).toBeNull();
    expect(fila?.ip).toBeNull();
    expect(fila?.userAgent).toBeNull();
    expect(fila?.metadata).toEqual({ prueba: true });
  });

  it('guarda la IP y el user-agent cuando se los dan', async () => {
    ({ prisma } = await import('@/lib/prisma'));

    await registrarAuditoria(prisma, {
      action: 'LOGIN_FAILED',
      entity: 'User',
      entityId: marca,
      ip: '203.0.113.7',
      userAgent: 'Mozilla/5.0 (prueba)',
      metadata: { email: 'ejemplo@example.org' },
    });

    const fila = await prisma.auditLog.findFirst({
      where: { entityId: marca, action: 'LOGIN_FAILED' },
    });

    expect(fila?.ip).toBe('203.0.113.7');
    expect(fila?.userAgent).toBe('Mozilla/5.0 (prueba)');
  });
});
