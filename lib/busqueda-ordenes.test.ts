import { describe, expect, it } from 'vitest';
import { palabrasBusqueda, gruposBusquedaOrdenes, paginasPorGrupo } from './busqueda-ordenes';
import { leerFiltros, serializarFiltros } from './filtros';
describe('relevancia antes de paginar', () => {
  it('normaliza tildes, separadores y mayúsculas sin alterar los originales', () => {
    expect(palabrasBusqueda('  IPAD / adquisición  ')).toEqual(['ipad', 'adquisicion']);
    expect(palabrasBusqueda('ipad ipad')).toEqual(['ipad']);
  });
  it('prefiere palabra completa a coincidencias dentro de equipado y mantiene filtros', () => {
    const base = { supplierId: 'proveedor' };
    const grupos = gruposBusquedaOrdenes('iPad', base);
    expect(grupos[1]).toEqual({ AND: [base, { descriptionSearch: { contains: ' ipad ' } }, { NOT: { OR: [expect.any(Object)] } }] });
    expect(grupos).toHaveLength(5);
    expect(grupos[4]).toEqual({ AND: [base, { NOT: { OR: expect.any(Array) } }] });
  });
  it('pagina entre grupos sin repetir ni cargar todos los resultados', () => {
    expect(paginasPorGrupo([1, 3, 0, 10, 2], 2, 3)).toEqual([{ grupo: 1, skip: 2, take: 1 }, { grupo: 3, skip: 0, take: 2 }]);
    expect(paginasPorGrupo([0, 0], 1, 20)).toEqual([]);
  });
  it('la búsqueda usa relevancia por defecto y conserva fecha explícita en los enlaces', () => {
    expect(leerFiltros({ texto: 'iPad' }).orden).toBe('relevancia');
    const f = leerFiltros({ texto: 'iPad', orden: 'fecha' });
    expect(serializarFiltros(f)).toContain('orden=fecha');
    expect(leerFiltros({}).orden).toBe('fecha');
  });
});
