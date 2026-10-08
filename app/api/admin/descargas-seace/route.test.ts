import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ permiso: vi.fn(), descargar: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ requierePermiso: mocks.permiso, NoAutenticado: class extends Error {}, SinPermiso: class extends Error {} }));
vi.mock('@/services/seaceHttpService', () => ({ descargarExcelSeace: mocks.descargar }));
import { NoAutenticado } from '@/lib/auth/session';
import { POST } from './route';
const body = { anio: 2018, mes: 2, ruc: '20146657142', municipio: 'San Ramón' };
function request(datos = body, origin = 'https://portal.test') {
  return new Request('https://portal.test/api/admin/descargas-seace', { method: 'POST', headers: { host: 'portal.test', origin }, body: JSON.stringify(datos) });
}
describe('descarga privada desde el administrador', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.permiso.mockResolvedValue({ id: 'admin' }); });
  it('exige sesión y permiso antes de conectar a SEACE', async () => {
    mocks.permiso.mockRejectedValue(new NoAutenticado());
    expect((await POST(request())).status).toBe(401);
    expect(mocks.descargar).not.toHaveBeenCalled();
  });
  it('rechaza otro origen, entradas inválidas y cuerpos grandes antes de descargar', async () => {
    expect((await POST(request(body, 'https://otro.test'))).status).toBe(403);
    expect((await POST(request({ ...body, mes: 13 }))).status).toBe(400);
    expect((await POST(request({ ...body, municipio: 'x'.repeat(3000) }))).status).toBe(413);
    expect(mocks.descargar).not.toHaveBeenCalled();
  });
  it('devuelve el archivo original con nombre seguro y sin cookies de SEACE', async () => {
    mocks.descargar.mockResolvedValue({ bytes: Buffer.from('original'), filename: 'Ordenes-y-servicios-2018-02-San-Ramon.xls' });
    const respuesta = await POST(request());
    expect(respuesta.status).toBe(200);
    expect(await respuesta.text()).toBe('original');
    expect(respuesta.headers.get('Content-Disposition')).toContain('2018-02-San-Ramon.xls');
    expect(respuesta.headers.get('Cache-Control')).toBe('private, no-store');
    expect(respuesta.headers.has('Set-Cookie')).toBe(false);
    expect(mocks.permiso).toHaveBeenCalledWith('imports:write');
    expect(mocks.descargar).toHaveBeenCalledWith('admin', 2018, 2, '20146657142', 'San Ramón');
  });
});
