import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ upsert: vi.fn(), findMany: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { publicSearchTerm: mocks } }));
import { busquedasPopulares, registrarBusquedaPublica } from './publicSearchTermsService';

describe('sugerencias basadas en búsquedas públicas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normaliza y agrega sin almacenar identidad del visitante', async () => {
    mocks.upsert.mockResolvedValue({});
    expect(await registrarBusquedaPublica('  Mantenimiento   de motos ')).toBe(true);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { normalizedTerm: 'mantenimiento de motos' },
      create: { normalizedTerm: 'mantenimiento de motos', displayTerm: 'Mantenimiento de motos' },
      update: expect.objectContaining({ uses: { increment: 1 } }),
    }));
  });

  it('rechaza fragmentos y devuelve las consultas más usadas', async () => {
    expect(await registrarBusquedaPublica('ab')).toBe(false);
    expect(mocks.upsert).not.toHaveBeenCalled();
    mocks.findMany.mockResolvedValue([{ displayTerm: 'Combustible' }, { displayTerm: 'iPad' }]);
    expect(await busquedasPopulares()).toEqual(['Combustible', 'iPad']);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ uses: 'desc' }, { lastUsedAt: 'desc' }] }));
  });
});
