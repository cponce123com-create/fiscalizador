import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ permiso: vi.fn(), paquete: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ requierePermiso: mocks.permiso, SinPermiso: class SinPermiso extends Error {}, NoAutenticado: class NoAutenticado extends Error {} }));
vi.mock('@/services/seaceExtensionService', () => ({ paqueteExtensionSeace: mocks.paquete }));
import { SinPermiso, NoAutenticado } from '@/lib/auth/session';
import { GET } from './route';
describe('paquete privado del descargador', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.permiso.mockResolvedValue({ id: 'admin' }); mocks.paquete.mockResolvedValue(Buffer.from('zip')); });
  it('no empaqueta código para visitantes o usuarios sin permiso', async () => {
    mocks.permiso.mockRejectedValueOnce(new NoAutenticado()); expect((await GET()).status).toBe(401);
    mocks.permiso.mockRejectedValueOnce(new SinPermiso('Sin permiso')); expect((await GET()).status).toBe(403);
    expect(mocks.paquete).not.toHaveBeenCalled();
  });
  it('entrega el ZIP con nombre instalable y sin caché compartida', async () => {
    const r = await GET();
    expect(mocks.permiso).toHaveBeenCalledWith('imports:write');
    expect(r.status).toBe(200); expect(r.headers.get('Content-Type')).toBe('application/zip');
    expect(r.headers.get('Content-Disposition')).toContain('Fiscalizador-SEACE-Chrome.zip');
    expect(r.headers.get('Cache-Control')).toBe('private, no-store');
    expect(Buffer.from(await r.arrayBuffer()).equals(Buffer.from('zip'))).toBe(true);
  });
});
