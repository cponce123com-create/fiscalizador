import { describe, expect, it } from 'vitest';
import { seleccionarPeriodoRanking } from './periodo-ranking';
import { leerFiltros, serializarFiltros } from './filtros';
import { destinoBusqueda } from './busqueda-en-vivo';

const periodos = [{ id: 'reciente' }, { id: 'anterior' }];

describe('periodo del ranking', () => {
  it('abre el más reciente y recupera parámetros inválidos', () => {
    for (const valor of [undefined, '', 'inexistente']) expect(seleccionarPeriodoRanking(valor, periodos)).toBe('reciente');
    expect(seleccionarPeriodoRanking(undefined, [])).toBe('todas');
  });
  it('respeta una gestión histórica y todos los periodos', () => {
    expect(seleccionarPeriodoRanking(['anterior', 'reciente'], periodos)).toBe('anterior');
    expect(seleccionarPeriodoRanking('todas', periodos)).toBe('todas');
  });
  it('conserva todos los periodos al paginar y buscar en vivo', () => {
    const filtros = leerFiltros({ gestion: 'todas', tipoRuc: '20' });
    const pagina = serializarFiltros(filtros, { pagina: 2 });
    expect(new URLSearchParams(pagina).get('gestion')).toBe('todas');
    const destino = destinoBusqueda('/ranking', pagina, new URLSearchParams({ texto: 'proveedor' }), ['texto']);
    const query = new URLSearchParams(destino?.split('?')[1]);
    expect(query.get('gestion')).toBe('todas');
    expect(query.get('tipoRuc')).toBe('20');
    expect(query.has('pagina')).toBe(false);
  });
});
