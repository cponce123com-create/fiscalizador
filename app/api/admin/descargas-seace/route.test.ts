import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ permiso: vi.fn(), crear: vi.fn(), mes: vi.fn(), eliminar: vi.fn(), obtener: vi.fn(), ultima: vi.fn(), zip: vi.fn() }));
vi.mock('@/lib/auth/session', () => {
  class NoAutenticado extends Error {}
  class SinPermiso extends Error {}
  return { NoAutenticado, SinPermiso, requierePermiso: mocks.permiso };
});
vi.mock('@/services/seaceDownloadService', () => ({ crearDescarga: mocks.crear, descargarMes: mocks.mes, eliminarDescarga: mocks.eliminar, obtenerDescarga: mocks.obtener, ultimaDescarga: mocks.ultima, zipDescarga: mocks.zip }));
import { NoAutenticado } from '@/lib/auth/session';
import { GET, POST } from './route';
const id = '149e3455-e6bc-4e10-a64b-2697a0f7b880';
function request(body: unknown, origin = 'https://portal.test') {
  return new Request('https://portal.test/api/admin/descargas-seace', { method: 'POST', headers: { host: 'portal.test', origin }, body: JSON.stringify(body) });
}
describe('API privada de descargas SEACE', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.permiso.mockResolvedValue({ id: 'admin' }); });
  it('exige autorización también para consultar y descargar ZIP', async () => {
    mocks.permiso.mockRejectedValue(new NoAutenticado());
    expect((await GET(new Request(`https://portal.test/api/admin/descargas-seace?id=${id}&zip=1`))).status).toBe(401);
    expect((await POST(request({ accion: 'crear', anio: 2015 }))).status).toBe(401);
    expect(mocks.zip).not.toHaveBeenCalled(); expect(mocks.crear).not.toHaveBeenCalled();
  });
  it('bloquea mutaciones desde otro origen y solicitudes inválidas', async () => {
    expect((await POST(request({ accion: 'crear', anio: 2015 }, 'https://otro.test'))).status).toBe(403);
    expect((await POST(request({ accion: 'mes', id, mes: 13 }))).status).toBe(400);
    expect((await POST(request({ accion: 'crear', anio: 2015, url: 'https://otro.test' }))).status).toBe(400);
    expect((await POST(request({ extra: 'x'.repeat(3000) }))).status).toBe(413);
    expect(mocks.crear).not.toHaveBeenCalled();
  });
  it('utiliza el usuario de sesión para todas las operaciones', async () => {
    mocks.crear.mockResolvedValue({ id });
    expect((await POST(request({ accion: 'crear', anio: 2015 }))).status).toBe(201);
    expect(mocks.crear).toHaveBeenCalledWith('admin', 2015);
    await POST(request({ accion: 'mes', id, mes: 1 }));
    expect(mocks.mes).toHaveBeenCalledWith('admin', id, 1);
    await POST(request({ accion: 'eliminar', id }));
    expect(mocks.eliminar).toHaveBeenCalledWith('admin', id);
    mocks.zip.mockResolvedValue(new Response('zip'));
    await GET(new Request(`https://portal.test/api/admin/descargas-seace?id=${id}&zip=1`));
    expect(mocks.zip).toHaveBeenCalledWith('admin', id);
    expect(mocks.permiso).toHaveBeenCalledWith('imports:write');
  });
});
