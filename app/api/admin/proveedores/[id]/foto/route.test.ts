import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ permiso: vi.fn(), profile: vi.fn(), read: vi.fn(), save: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ requierePermiso: mocks.permiso, SinPermiso: class SinPermiso extends Error {}, NoAutenticado: class NoAutenticado extends Error {} }));
vi.mock('@/lib/prisma', () => ({ prisma: { supplierProfile: { findUnique: mocks.profile } } }));
vi.mock('@/services/privatePhotoStorage', () => ({ leerFotoPrivada: mocks.read, guardarFotoPrivada: mocks.save, retirarFotoPrivada: vi.fn(), MAX_FOTO_BYTES: 2 * 1024 * 1024 }));
import { SinPermiso, NoAutenticado } from '@/lib/auth/session';
import { GET, POST } from './route';
const contexto = () => ({ params: Promise.resolve({ id: 'id' }) });
const url = 'https://ejemplo.test/api/admin/proveedores/id/foto';
describe('privacidad de fotos de perfiles', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.permiso.mockResolvedValue({ id: 'admin' }); });
  it('bloquea usuarios sin sesión o permiso antes de consultar la ficha', async () => {
    mocks.permiso.mockRejectedValueOnce(new NoAutenticado());
    expect((await GET(new Request(url), contexto())).status).toBe(401);
    mocks.permiso.mockRejectedValueOnce(new SinPermiso('Sin permiso'));
    expect((await GET(new Request(url), contexto())).status).toBe(403);
    expect(mocks.profile).not.toHaveBeenCalled();
  });
  it('sirve fotos sin caché compartida y exige permiso privado', async () => {
    mocks.profile.mockResolvedValue({ photoKey: 'key', photoMime: 'image/webp' }); mocks.read.mockResolvedValue(Buffer.from('foto'));
    const response = await GET(new Request(url), contexto());
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(mocks.permiso).toHaveBeenCalledWith('persons:read');
  });
  it('acepta el origen público tras el proxy de Render sin depender de la URL interna', async () => {
    const request = new Request('http://internal:10000/api/admin/proveedores/id/foto', { method: 'POST', body: new FormData(), headers: { origin: 'https://fiscalizador.onrender.com', host: 'internal:10000', 'x-forwarded-host': 'fiscalizador.onrender.com' } });
    const response = await POST(request, contexto());
    expect(response.status).toBe(409); // Falta una foto, pero el origen fue aceptado.
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('bloquea modificaciones sin permiso y solicitudes de otro origen', async () => {
    mocks.permiso.mockRejectedValueOnce(new SinPermiso('Sin permiso'));
    expect((await POST(new Request(url, { method: 'POST' }), contexto())).status).toBe(403);
    expect((await POST(new Request(url, { method: 'POST', headers: { origin: 'https://otra.test' } }), contexto())).status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.permiso).toHaveBeenCalledWith('persons:write');
  });
});
