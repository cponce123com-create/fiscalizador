import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GastoAlimentacion } from './gasto-alimentacion';

describe('comparación de alimentación', () => {
  it('distingue falta de cobertura de cero coincidencias y enlaza las órdenes', () => {
    const html = renderToStaticMarkup(createElement(GastoAlimentacion, { filas: [
      { id: 'a', gestion: '2015-2018', meses: 0, ordenes: 0, anuladas: 0, considerado: '0.00' },
      { id: 'b', gestion: '2019-2022', meses: 3, ordenes: 0, anuladas: 0, considerado: '0.00' },
      { id: 'c', gestion: '2023-2026', meses: 4, ordenes: 7, anuladas: 1, considerado: '123.45' },
    ] }));
    expect(html).toContain('Sin libros publicados');
    expect(html).toContain('3 meses disponibles');
    expect(html).toContain('href="/alimentacion?gestion=c"');
    expect(html).toContain('cada orden suma una sola vez');
  });
});
