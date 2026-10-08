import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TarjetaPrensa } from './tarjeta-prensa';
import type { ContratacionPrensa } from '@/lib/prensa';

const ficha: ContratacionPrensa = { ruc: '10454761923', nombre: 'Mariella Galarza', nombreListado: 'Galarza Villar Mariella', tipo: 'Persona natural', ordenes: 2, anuladas: 1, registrado: '150.00', anulado: '50.00', considerado: '100.00', primera: '2015-01-01', ultima: '2026-01-01', fotoUrl: null, perfilUrl: '/proveedores/mariella-galarza' };

describe('tarjetas de prensa', () => {
  it('enlaza a la ficha única del proveedor y etiqueta las cifras como órdenes', () => {
    const html = renderToStaticMarkup(createElement(TarjetaPrensa, { fila: ficha }));
    expect(html).toContain('href="/proveedores/mariella-galarza"');
    expect(html).toContain('Monto considerado');
    expect(html).toContain('todos los periodos');
    expect(html).toContain('anuladas, excluidas del monto');
  });
  it('distingue ausencia de información de un monto cero y conserva un perfil accesible', () => {
    const html = renderToStaticMarkup(createElement(TarjetaPrensa, { fila: { ...ficha, ordenes: 0, perfilUrl: '/prensa/10454761923' } }));
    expect(html).toContain('href="/prensa/10454761923"');
    expect(html).toContain('Sin coincidencias');
    expect(html).not.toContain('Monto considerado');
  });
});
