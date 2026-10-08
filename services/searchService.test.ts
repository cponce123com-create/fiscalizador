import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ proveedores: vi.fn(), ordenes: vi.fn() }));
vi.mock('@/services/statisticsService', () => ({ listarProveedores: mocks.proveedores, listarOrdenes: mocks.ordenes }));
import { buscarEnPortal } from './searchService';

describe('búsqueda principal agrupada', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.proveedores.mockResolvedValue({ total: 0, filas: [] });
    mocks.ordenes.mockResolvedValue({ total: 0, filas: [] });
  });
  it('valida el texto antes de consultar la base', async () => {
    for (const texto of ['', ' a ', '12', 'x'.repeat(121)]) {
      expect(await buscarEnPortal(texto)).toEqual({ total: 0, filas: [], totalProveedores: 0, proveedores: [] });
    }
    expect(mocks.proveedores).not.toHaveBeenCalled();
    expect(mocks.ordenes).not.toHaveBeenCalled();
  });
  it('busca nombres y objetos a la vez y limita la proyección a datos públicos', async () => {
    mocks.proveedores.mockResolvedValue({ total: 12, filas: [{ id: 'p', nombre: 'José Galarza', ruc: '10123456789', slug: 'jose-galarza', ordenes: 9, privateNotes: 'privado', birthPlace: 'privado' }] });
    mocks.ordenes.mockResolvedValue({ total: 30, filas: [{ id: 'o', orderNumber: 'OC1', proveedor: 'José Galarza', description: 'Mantenimiento de moto', privateNotes: 'privado' }] });
    expect(await buscarEnPortal(' galarza ')).toEqual({ totalProveedores: 12, proveedores: [{ id: 'p', nombre: 'José Galarza', ruc: '10123456789', slug: 'jose-galarza', ordenes: 9 }], total: 30, filas: [{ id: 'o', numero: 'OC1', proveedor: 'José Galarza', descripcion: 'Mantenimiento de moto' }] });
    for (const fn of [mocks.proveedores, mocks.ordenes]) expect(fn).toHaveBeenCalledWith(expect.objectContaining({ texto: 'galarza', porPagina: 5, pagina: 1, orden: 'relevancia' }));
  });
  it('devuelve compras aunque no haya proveedores con ese nombre', async () => {
    mocks.ordenes.mockResolvedValue({ total: 1, filas: [{ id: 'o', orderNumber: 'OC2', proveedor: 'Servicios SAC', description: 'Bocaditos' }] });
    const resultado = await buscarEnPortal('bocaditos');
    expect(resultado.totalProveedores).toBe(0);
    expect(resultado.total).toBe(1);
    expect(resultado.filas[0]?.descripcion).toBe('Bocaditos');
  });
});
