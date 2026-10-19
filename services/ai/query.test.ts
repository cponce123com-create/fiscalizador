import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
import { filtrosIA } from './query';
import type { PlanIA } from '@/lib/ia';
const base: PlanIA = { accion: 'consultar', proveedor: null, categoria: null, municipalidades: [], desde: null, hasta: null, variasMunicipalidades: false };
describe('consultas de IA', () => {
  it('excluye anuladas, estados sin efecto y libros pendientes', () => {
    const sql = filtrosIA(base);
    expect(sql.sql).toContain('"isCancelled" = false');
    expect(sql.sql).toContain('"countsEconomically" = true');
    expect(sql.sql).toContain('"requiresReview" = false');
  });
  it('parametriza municipios, fechas y nombres sin interpolar SQL', () => {
    const ataque = "x'; DROP TABLE Supplier; --";
    const sql = filtrosIA({ ...base, proveedor: ataque, municipalidades: ['oxapampa'], desde: 2025, hasta: 2025 });
    expect(sql.sql).not.toContain(ataque);
    expect(sql.values).toContain(ataque);
    expect(sql.values).toContain('oxapampa');
    expect(sql.values).toContainEqual(new Date('2026-01-01T00:00:00Z'));
  });
  it('no ignora silenciosamente una categoría desconocida', () => {
    expect(() => filtrosIA({ ...base, categoria: 'inventada' })).toThrow();
  });
});
