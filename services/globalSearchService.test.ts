import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: query } }));

import { buscarProveedoresGlobal } from './globalSearchService';

describe('búsqueda global de proveedores', () => {
  beforeEach(() => vi.clearAllMocks());

  it('no consulta la base con menos de tres caracteres', async () => {
    expect(await buscarProveedoresGlobal('po')).toEqual({ totalProveedores: 0, proveedores: [] });
    expect(query).not.toHaveBeenCalled();
  });

  it('consolida órdenes, montos, periodos y municipalidades sin perder centavos', async () => {
    query
      .mockResolvedValueOnce([{ n: 1 }])
      .mockResolvedValueOnce([
        { supplierId: 'p1', supplierName: 'POMA GENARO', ruc: '10123456789', supplierSlug: 'poma-genaro', municipalityId: 'm1', municipalitySlug: 'san-ramon', municipalityName: 'San Ramón', periodName: '2019-2022', ordenes: 2, considerado: '10.10' },
        { supplierId: 'p1', supplierName: 'POMA GENARO', ruc: '10123456789', supplierSlug: 'poma-genaro', municipalityId: 'm1', municipalitySlug: 'san-ramon', municipalityName: 'San Ramón', periodName: '2023-2026', ordenes: 1, considerado: '0.20' },
        { supplierId: 'p1', supplierName: 'POMA GENARO', ruc: '10123456789', supplierSlug: 'poma-genaro', municipalityId: 'm2', municipalitySlug: 'vitoc', municipalityName: 'Vítoc', periodName: '2023-2026', ordenes: 3, considerado: '5.05' },
      ]);

    const resultado = await buscarProveedoresGlobal('genaro poma');
    expect(resultado.totalProveedores).toBe(1);
    expect(resultado.proveedores[0]).toMatchObject({ ordenes: 6, considerado: '15.35' });
    expect(resultado.proveedores[0].municipalidades[0]).toMatchObject({ ordenes: 3, considerado: '10.30', periodos: ['2019-2022', '2023-2026'] });
  });
});
