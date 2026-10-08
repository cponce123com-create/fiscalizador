import { beforeEach, describe, expect, it, vi } from 'vitest';
const query = vi.hoisted(() => vi.fn());
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: query } }));
import { gastoAlimentacionPorGestion, listarOrdenesAlimentacion } from './foodService';
import { filtrosPorDefecto } from '@/lib/filtros';

describe('gastos de alimentación', () => {
  beforeEach(() => query.mockReset());
  it('conserva cobertura y cantidades y formatea montos decimales', async () => {
    query.mockResolvedValue([{ id: 'g', gestion: '2023-2026', meses: 2, ordenes: 3, anuladas: 1, considerado: '123456789012.10' }]);
    expect(await gastoAlimentacionPorGestion()).toEqual([{ id: 'g', gestion: '2023-2026', meses: 2, ordenes: 3, anuladas: 1, considerado: '123456789012.10' }]);
  });
  it('limita la página a las órdenes existentes y conserva montos desconocidos', async () => {
    query.mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([{ id: 'o', amount: null }]);
    const resultado = await listarOrdenesAlimentacion({ ...filtrosPorDefecto(), gestionId: 'g', pagina: 50 });
    expect(resultado.pagina).toBe(1);
    expect(resultado.totalPaginas).toBe(1);
    expect(resultado.filas[0]?.amount).toBeNull();
  });
});
