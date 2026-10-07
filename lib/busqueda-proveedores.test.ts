import { describe, expect, it } from 'vitest';
import { filtrosPorDefecto, leerFiltros } from './filtros';
import { destinoBusquedaProveedores } from './busqueda-proveedores';

describe('búsqueda progresiva de proveedores', () => {
  it.each(['2', '20', '  ab  '])('no consulta el fragmento corto %s', texto => {
    expect(destinoBusquedaProveedores(filtrosPorDefecto(), texto, '')).toBeNull();
  });
  it('busca a partir del tercer dígito, reinicia página y conserva el tipo elegido', () => {
    const destino = destinoBusquedaProveedores(leerFiltros({ pagina: '4', porPagina: '40', tipoRuc: '10' }), ' 206 ', '20');
    const url = new URL(destino!, 'https://ejemplo.test');
    expect(url.pathname).toBe('/proveedores');
    expect(url.searchParams.get('texto')).toBe('206');
    expect(url.searchParams.get('tipoRuc')).toBe('20');
    expect(url.searchParams.get('pagina')).toBeNull();
    expect(url.searchParams.get('porPagina')).toBe('40');
  });
  it('al limpiar el texto elimina la búsqueda anterior sin perder el tipo', () => {
    const destino = destinoBusquedaProveedores(leerFiltros({ texto: 'acme', pagina: '3', tipoRuc: '20' }), ' ', '20');
    expect(destino).toBe('/proveedores?tipoRuc=20');
  });
  it('codifica nombres y símbolos como texto, sin convertirlos en parámetros', () => {
    const destino = destinoBusquedaProveedores(filtrosPorDefecto(), 'José & Hijos / SAC', '');
    const parametros = new URL(destino!, 'https://ejemplo.test').searchParams;
    expect(parametros.get('texto')).toBe('José & Hijos / SAC');
    expect([...parametros.keys()]).toEqual(['texto']);
  });
  it('permite buscar por DNI dentro del administrador sin salir a la página pública', () => {
    const destino = destinoBusquedaProveedores(filtrosPorDefecto(), '00123456', '10', '/admin/proveedores');
    const url = new URL(destino!, 'https://ejemplo.test');
    expect(url.pathname).toBe('/admin/proveedores');
    expect(url.searchParams.get('texto')).toBe('00123456');
  });
  it('descarta términos inválidos en lugar de abrir consultas generales', () => {
    expect(destinoBusquedaProveedores(filtrosPorDefecto(), 'a'.repeat(121), '')).toBeNull();
    expect(destinoBusquedaProveedores(filtrosPorDefecto(), 'abc\u0000', '')).toBeNull();
  });
});
