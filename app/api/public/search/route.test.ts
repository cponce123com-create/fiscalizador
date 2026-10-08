import { beforeEach, describe, expect, it, vi } from 'vitest';
const buscar = vi.hoisted(() => vi.fn());
vi.mock('@/services/searchService', () => ({ buscarEnPortal: buscar }));
import { GET } from './route';

describe('sugerencias públicas agrupadas', () => {
  beforeEach(() => { buscar.mockReset(); });
  it('entrega proveedores y órdenes con cache desactivada', async () => {
    const resultado = { totalProveedores: 1, proveedores: [{ id: 'p', nombre: 'Galarza', ruc: '10123456789', slug: 'galarza', ordenes: 5 }], total: 0, filas: [] };
    buscar.mockResolvedValue(resultado);
    const response = await GET(new Request('https://portal.test/api/public/search?texto=%20galarza%20'));
    expect(buscar).toHaveBeenCalledWith('galarza');
    expect(await response.json()).toEqual(resultado);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it('oculta errores internos', async () => {
    buscar.mockRejectedValue(new Error('database secret'));
    const response = await GET(new Request('https://portal.test/api/public/search?texto=compra'));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('database secret');
  });
});
