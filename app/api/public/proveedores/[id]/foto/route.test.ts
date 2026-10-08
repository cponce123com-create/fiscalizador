import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ perfil: vi.fn(), leer: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { supplierProfile: { findUnique: mocks.perfil } } }));
vi.mock('@/services/privatePhotoStorage', () => ({ leerFotoPrivada: mocks.leer }));
import { GET } from './route';

describe('foto pública del proveedor', () => {
  beforeEach(() => { mocks.perfil.mockReset(); mocks.leer.mockReset(); });
  const contexto = { params: Promise.resolve({ id: 'abc' }) };
  it('sirve bytes sin revelar la clave ni requerir sesión administrativa', async () => {
    mocks.perfil.mockResolvedValue({ isPublic: true, publication: { foto: { enabled: true, sourceUrl: null, verifiedAt: '2026-10-07T00:00:00.000Z' } }, photoKey: 'clave-secreta', photoMime: 'image/webp' });
    mocks.leer.mockResolvedValue(Buffer.from('foto'));
    const response = await GET(new Request('https://portal.test'), contexto);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.text()).toBe('foto');
    expect(mocks.perfil).toHaveBeenCalledWith({ where: { supplierId: 'abc' }, select: { isPublic: true, publication: true, photoKey: true, photoMime: true } });
  });
  it('devuelve 404 si se retira la foto o falla su almacenamiento', async () => {
    mocks.perfil.mockResolvedValue(null);
    expect((await GET(new Request('https://portal.test'), contexto)).status).toBe(404);
    mocks.perfil.mockResolvedValue({ photoKey: 'clave' });
    mocks.leer.mockRejectedValue(new Error('credencial interna'));
    expect((await GET(new Request('https://portal.test'), contexto)).status).toBe(404);
  });
  it('no lee el almacenamiento de una foto sin autorización de publicación', async () => {
    mocks.perfil.mockResolvedValue({ photoKey: 'clave', isPublic: false, publication: {} });
    expect((await GET(new Request('https://portal.test'), contexto)).status).toBe(404);
    expect(mocks.leer).not.toHaveBeenCalled();
  });

});
