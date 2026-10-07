import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Prisma, type PrismaClient } from '@/lib/generated/prisma/client';

const mocks = vi.hoisted(() => ({ permiso: vi.fn(), subir: vi.fn(), retirar: vi.fn(), refresh: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ requierePermiso: mocks.permiso, SinPermiso: class extends Error {}, NoAutenticado: class extends Error {} }));
vi.mock('@/services/portalImageStorage', () => ({ subirImagenPortal: mocks.subir, retirarImagenPortal: mocks.retirar }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.refresh }));

// Solo PostgreSQL temporal de CI o TEST_DATABASE_URL: nunca la conexión de producción.
describe.skipIf(process.env.INTEGRATION_TESTS_ENABLED !== '1')('guardado de imágenes con el adapter PostgreSQL real', () => {
  let db: PrismaClient;
  let api: typeof import('./route');
  let userId: string;
  let previo: Awaited<ReturnType<PrismaClient['appSetting']['findUnique']>>;
  const key = 'portal-imagen-social';
  const contexto = { params: Promise.resolve({ tipo: 'social' }) };
  const imagen = { url: 'https://res.cloudinary.com/test/image/upload/social.png', publicId: `fiscalizador/portal/${randomUUID()}`, cloud: 'test', credito: '' };

  beforeAll(async () => {
    db = (await import('@/lib/prisma')).prisma;
    api = await import('./route');
    previo = await db.appSetting.findUnique({ where: { key } });
    const user = await db.user.create({ data: { email: `test-apariencia-${randomUUID()}@example.test`, role: 'SUPERADMIN' } });
    userId = user.id;
    mocks.permiso.mockResolvedValue({ id: userId });
    mocks.subir.mockImplementation(async () => ({ ...imagen }));
    mocks.retirar.mockResolvedValue(undefined);
  });
  afterAll(async () => {
    if (!db) return;
    if (previo) {
      const data = { key, value: previo.value ?? Prisma.JsonNull, updatedAt: previo.updatedAt };
      await db.appSetting.upsert({ where: { key }, create: data, update: data });
    }
    else await db.appSetting.deleteMany({ where: { key } });
    if (userId) {
      await db.auditLog.deleteMany({ where: { userId } });
      await db.user.delete({ where: { id: userId } });
    }
  });
  it('confirma la subida y la auditoría sin deserializar una columna void', async () => {
    const form = new FormData();
    form.set('imagen', new File(['imagen de prueba'], 'social.png', { type: 'image/png' }));
    const response = await api.POST(new Request('https://portal.test/api/admin/apariencia/imagenes/social', { method: 'POST', headers: { origin: 'https://portal.test' }, body: form }), contexto);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, url: imagen.url });
    expect((await db.appSetting.findUnique({ where: { key } }))?.value).toEqual(imagen);
    expect(await db.auditLog.count({ where: { userId, entityId: key, action: 'CHANGE_SETTINGS' } })).toBe(1);
    expect(mocks.refresh).toHaveBeenCalledWith('/', 'layout');
  });
  it('confirma la retirada con el mismo bloqueo y limpia el recurso anterior', async () => {
    // Este caso no depende del orden de ejecución de la prueba de subida.
    await db.appSetting.upsert({ where: { key }, create: { key, value: imagen }, update: { value: imagen } });
    const response = await api.DELETE(new Request('https://portal.test/api/admin/apariencia/imagenes/social', { method: 'DELETE', headers: { origin: 'https://portal.test' } }), contexto);
    expect(response.status).toBe(200);
    expect((await db.appSetting.findUnique({ where: { key } }))?.value).toEqual({ url: '', publicId: null, cloud: null, credito: '' });
    expect(mocks.retirar).toHaveBeenCalledWith(imagen);
  });
});
