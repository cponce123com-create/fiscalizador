import { beforeEach, describe, expect, it, vi } from 'vitest';
const query = vi.hoisted(() => vi.fn());
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: query } }));
import { contratacionesPrensa } from './pressService';

const uno = { ruc: '10454761923', nombre: 'Galarza Villar Mariella' };
const dos = { ruc: '10205673585', nombre: 'Galarza Pérez Florencio' };
function agregado(ruc: string, monto: string, ordenes = 2) {
  return { id: ruc, ruc, nombre: 'Nombre del libro', slug: `proveedor-${ruc}`, ordenes, anuladas: 1, registrado: '110.00', anulado: '10.00', considerado: monto, primera: '2015-01-01', ultima: '2026-02-01', fotoUrl: null };
}

describe('cruce de prensa con libros publicados', () => {
  beforeEach(() => { query.mockReset(); });
  it('cruza por RUC exacto y usa cifras de los libros en todos los periodos', async () => {
    query.mockResolvedValue([agregado(uno.ruc, '100.00')]);
    const r = await contratacionesPrensa([uno, dos]);
    expect(r.conOrdenes).toBe(1);
    expect(r.ordenes).toBe(2);
    expect(r.considerado).toBe('100.00');
    expect(r.filas[0]).toMatchObject({ nombreListado: uno.nombre, nombre: 'Nombre del libro', registrado: '110.00', anulado: '10.00', considerado: '100.00', perfilUrl: `/proveedores/proveedor-${uno.ruc}` });
    expect(r.filas[1]).toMatchObject({ ruc: dos.ruc, ordenes: 0, perfilUrl: `/prensa/${dos.ruc}`, fotoUrl: null });
    expect(JSON.stringify(r)).not.toContain('"dni"');
  });
  it('no atribuye las órdenes de una empresa a una persona del mismo nombre', async () => {
    query.mockResolvedValue([agregado('20486447240', '700.00')]);
    const r = await contratacionesPrensa([uno]);
    expect(r.filas[0]?.ordenes).toBe(0);
    expect(r.considerado).toBe('0.00');
  });
  it('suma decimales sin pérdida de precisión y deduplica el RUC', async () => {
    query.mockResolvedValue([agregado(uno.ruc, '999999999999.91'), agregado(dos.ruc, '0.09')]);
    const r = await contratacionesPrensa([uno, uno, dos]);
    expect(r.filas).toHaveLength(2);
    expect(r.considerado).toBe('1000000000000.00');
    expect(r.ordenes).toBe(4);
  });
  it('mantiene la ficha de seguimiento aunque aún no haya órdenes', async () => {
    query.mockResolvedValue([]);
    const r = await contratacionesPrensa([uno]);
    expect(r.filas[0]?.nombre).toBe(uno.nombre);
    expect(r.conOrdenes).toBe(0);
    expect(r.filas[0]?.perfilUrl).toBe(`/prensa/${uno.ruc}`);
    expect(await contratacionesPrensa([])).toEqual({ filas: [], conOrdenes: 0, ordenes: 0, considerado: '0.00' });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
