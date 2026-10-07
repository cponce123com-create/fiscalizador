import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { importBatch: mocks } }));
import { listarFuentesLibros } from './sourceBooksService';
describe('inventario público de fuentes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.count.mockResolvedValue(25);
    mocks.findMany.mockResolvedValueOnce([{ id: 'importado', status: 'COMPLETED' }, { id: 'observado', status: 'COMPLETED_WITH_WARNINGS' }]).mockResolvedValueOnce([{ id: 'importado', status: 'COMPLETED' }]);
  });
  it('solo consulta libros confirmados en inventario, listado y contador', async () => {
    const datos = await listarFuentesLibros({});
    expect(datos.inventario.map(b => b.id)).toEqual(['importado', 'observado']);
    expect(datos.lotes[0].status).toBe('COMPLETED');
    expect(mocks.findMany.mock.calls[0][0].where).toEqual({ status: { in: ['COMPLETED', 'COMPLETED_WITH_WARNINGS'] } });
    expect(mocks.findMany.mock.calls[1][0].where).toEqual({ status: { in: ['COMPLETED', 'COMPLETED_WITH_WARNINGS'] } });
    expect(mocks.count.mock.calls[0][0].where).toEqual({ status: { in: ['COMPLETED', 'COMPLETED_WITH_WARNINGS'] } });
    expect(mocks.findMany.mock.calls[1][0].select._count).toEqual({ select: { orders: true } });
  });
  it('filtra periodo y tipo, con páginas limitadas en la base', async () => {
    const datos = await listarFuentesLibros({ year: '2026', month: '2', tipo: 'CONSOLIDADO', page: '2' });
    expect(datos.pagina).toBe(2);
    expect(mocks.findMany.mock.calls[1][0]).toMatchObject({ where: { year: 2026, month: 2, importType: 'CONSOLIDADO' }, take: 12, skip: 12 });
  });
  it('normaliza filtros inválidos y páginas fuera de rango', async () => {
    const datos = await listarFuentesLibros({ year: 'NaN', month: '99', tipo: 'otro', page: '9999' });
    expect(datos.filtros).toEqual({ year: undefined, month: undefined, tipo: undefined });
    expect(datos.pagina).toBe(3);
    expect(mocks.findMany.mock.calls[1][0]).toMatchObject({ skip: 24, take: 12 });
  });
});
