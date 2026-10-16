import { beforeEach, describe, expect, it, vi } from 'vitest';
import { filtrosPorDefecto } from '@/lib/filtros';

const query = vi.hoisted(() => vi.fn());
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: query } }));
vi.mock('@/services/municipalityService', () => ({
  idMunicipalidadDesdeSlug: vi.fn(async (slug?: string | null) => slug === 'oxapampa' ? 'mun-oxapampa' : 'mun-san-ramon'),
}));

import { listarOrdenes } from './statisticsService';

describe('búsqueda híbrida de órdenes', () => {
  beforeEach(() => query.mockReset());

  it('resuelve relevancia con un conteo y una página Full Text Search', async () => {
    query
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([{ id: 'o1', orderNumber: '182', issueDate: new Date('2015-03-09'), description: 'COMPRA DE IPAD', amount: '1200.00', ruc: '10123456789', isCancelled: false, tipo: 'O/C', estado: 'Comprometida', proveedor: 'PROVEEDOR', proveedorSlug: 'proveedor' }]);

    const resultado = await listarOrdenes({
      ...filtrosPorDefecto(),
      municipalidadSlug: 'oxapampa',
      texto: 'iPad',
      orden: 'relevancia',
      pagina: 50,
      porPagina: 5,
    });

    expect(query).toHaveBeenCalledTimes(2);
    expect(resultado).toMatchObject({ total: 1, pagina: 1, totalPaginas: 1, porPagina: 5 });
    expect(resultado.filas[0]).toMatchObject({ id: 'o1', description: 'COMPRA DE IPAD', amount: '1200.00' });
  });
});
