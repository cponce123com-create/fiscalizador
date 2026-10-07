import { beforeEach, describe, expect, it, vi } from 'vitest';
const listar = vi.hoisted(() => vi.fn());
vi.mock('@/services/statisticsService', () => ({ listarOrdenes: listar }));
import { GET } from './route';

describe('sugerencias públicas', () => {
  beforeEach(() => { listar.mockReset(); });
  it('no consulta búsquedas cortas o inválidas', async () => {
    for (const texto of ['12', 'x'.repeat(121)]) {
      expect(await (await GET(new Request(`https://portal.test/api/public/search?texto=${texto}`))).json()).toEqual({ filas: [], total: 0 });
    }
    expect(listar).not.toHaveBeenCalled();
  });
  it('limita a cinco y entrega solo campos de presentación', async () => {
    listar.mockResolvedValue({ total: 8, filas: [{ id: 'abc', orderNumber: 'OC1', proveedor: 'Proveedor', description: 'Compra', privateNotes: 'oculto', ruc: '20123456789' }] });
    const response = await GET(new Request('https://portal.test/api/public/search?texto=compra'));
    expect(listar).toHaveBeenCalledWith(expect.objectContaining({ texto: 'compra', porPagina: 5, pagina: 1 }));
    expect(await response.json()).toEqual({ total: 8, filas: [{ id: 'abc', numero: 'OC1', proveedor: 'Proveedor', descripcion: 'Compra' }] });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it('oculta errores internos', async () => {
    listar.mockRejectedValue(new Error('database secret'));
    const response = await GET(new Request('https://portal.test/api/public/search?texto=compra'));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('database secret');
  });
});
