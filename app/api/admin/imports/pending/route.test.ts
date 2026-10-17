import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ permiso: vi.fn(), activa: vi.fn(), lotes: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ requierePermiso: mocks.permiso, NoAutenticado: class NoAutenticado extends Error {}, SinPermiso: class SinPermiso extends Error {} }));
vi.mock('@/services/municipalityService', () => ({ asegurarMunicipalidadActiva: mocks.activa }));
vi.mock('@/lib/prisma', () => ({ prisma: { importBatch: { findMany: mocks.lotes } } }));
import { GET } from './route';

describe('análisis de importación recuperables', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.permiso.mockResolvedValue({ id: 'admin' }); mocks.activa.mockResolvedValue('mun-x'); mocks.lotes.mockResolvedValue([]); });
  it('exige permiso de escritura y municipalidad explícita', async () => {
    expect((await GET(new Request('https://portal.test/api/admin/imports/pending'))).status).toBe(409);
    expect(mocks.lotes).not.toHaveBeenCalled();
  });
  it('solo consulta lotes pendientes con original guardado en la municipalidad elegida', async () => {
    const response = await GET(new Request('https://portal.test/api/admin/imports/pending?municipalityId=mun-x'));
    expect(response.status).toBe(200);
    expect(mocks.permiso).toHaveBeenCalledWith('imports:write');
    expect(mocks.activa).toHaveBeenCalledWith('mun-x');
    expect(mocks.lotes).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ municipalityId: 'mun-x', storageKey: { not: null }, OR: expect.arrayContaining([expect.objectContaining({ status: { in: ['VALIDATING', 'FAILED'] } })]) }),
      take: 200,
    }));
  });
});
