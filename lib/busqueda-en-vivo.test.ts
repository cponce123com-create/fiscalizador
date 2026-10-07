import { describe, expect, it } from 'vitest';
import { destinoBusqueda } from './busqueda-en-vivo';

describe('búsqueda en vivo GET', () => {
  it('conserva filtros ajenos, reemplaza texto y reinicia ambas paginaciones', () => {
    const destino = destinoBusqueda('/ordenes', 'anio=2025&pagina=8&page=2&texto=viejo&direccion=asc', new URLSearchParams('texto= 123 &mes=3'), ['texto', 'mes']);
    const url = new URL(destino!, 'https://portal.test');
    expect(Object.fromEntries(url.searchParams)).toEqual({ anio: '2025', direccion: 'asc', texto: '123', mes: '3' });
  });
  it('espera tres caracteres, admite envío manual y permite borrar', () => {
    expect(destinoBusqueda('/ordenes', '', new URLSearchParams('texto=12'), ['texto'])).toBeNull();
    expect(destinoBusqueda('/ordenes', '', new URLSearchParams('texto=12'), ['texto'], true)).toBe('/ordenes?texto=12');
    expect(destinoBusqueda('/ordenes', 'texto=123', new URLSearchParams('texto='), ['texto'])).toBe('/ordenes');
  });
  it('elimina casillas desmarcadas y conserva la ficha seleccionada', () => {
    expect(destinoBusqueda('/admin/personas', 'ficha=abc&soloAnuladas=1', new URLSearchParams('q=ana'), ['q', 'soloAnuladas'])).toBe('/admin/personas?ficha=abc&q=ana');
  });
});
