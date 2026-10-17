import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ permiso: vi.fn(), reanalizar: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ requierePermiso: mocks.permiso, NoAutenticado: class NoAutenticado extends Error {}, SinPermiso: class SinPermiso extends Error {} }));
vi.mock('@/services/importService', () => ({ reanalizarLote: mocks.reanalizar }));
import { POST } from './route';

describe('reanálisis de un original guardado', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.permiso.mockResolvedValue({ id: 'admin' }); mocks.reanalizar.mockResolvedValue({ importBatchId: 'lote-1' }); });
  it('solo permite iniciar la operación con permiso de importación', async () => {
    const response = await POST(new Request('https://portal.test', { method: 'POST' }), { params: Promise.resolve({ id: 'lote-1' }) });
    expect(response.status).toBe(200);
    expect(mocks.permiso).toHaveBeenCalledWith('imports:write');
    expect(mocks.reanalizar).toHaveBeenCalledWith('lote-1');
  });
});
