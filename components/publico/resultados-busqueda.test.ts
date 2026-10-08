import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ResultadosBusqueda } from './resultados-busqueda';
import type { ResultadoBusquedaPublica } from '@/lib/busqueda-publica';

const resultado: ResultadoBusquedaPublica = {
  totalProveedores: 1,
  proveedores: [{ id: 'p', nombre: 'José Galarza', ruc: '10123456789', slug: 'jose-galarza', ordenes: 9 }],
  total: 1,
  filas: [{ id: 'o', numero: 'OC1', proveedor: 'José Galarza', descripcion: 'Mantenimiento de moto' }],
};

describe('resultados de la búsqueda principal', () => {
  it('muestra las fichas de proveedores antes de las órdenes y enlaza a ambos listados', () => {
    const html = renderToStaticMarkup(createElement(ResultadosBusqueda, { resultado, texto: 'Galarza' }));
    expect(html.indexOf('Proveedores coincidentes')).toBeLessThan(html.indexOf('Órdenes coincidentes'));
    expect(html).toContain('href="/proveedores/jose-galarza"');
    expect(html).toContain('href="/ordenes/o"');
    expect(html).toContain('href="/proveedores?texto=Galarza"');
    expect(html).toContain('href="/ordenes?texto=Galarza"');
  });
  it('muestra compras cuando el término solo coincide con un objeto', () => {
    const html = renderToStaticMarkup(createElement(ResultadosBusqueda, { resultado: { ...resultado, totalProveedores: 0, proveedores: [] }, texto: 'moto' }));
    expect(html).not.toContain('Proveedores coincidentes');
    expect(html).toContain('Órdenes coincidentes');
    expect(html).toContain('<mark');
  });
});
