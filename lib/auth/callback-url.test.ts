import { describe, expect, it } from 'vitest';

import { validarCallbackAdmin } from './callback-url';

describe('validarCallbackAdmin', () => {
  it('acepta rutas internas del panel', () => {
    expect(validarCallbackAdmin('/admin/proveedores?texto=poma')).toBe(
      '/admin/proveedores?texto=poma',
    );
    expect(validarCallbackAdmin('/admin/comparador')).toBe('/admin/comparador');
  });

  it('bloquea destinos externos o ambiguos', () => {
    expect(validarCallbackAdmin('https://evil.test/admin')).toBe('/admin');
    expect(validarCallbackAdmin('//evil.test/admin')).toBe('/admin');
    expect(validarCallbackAdmin('/admin/../api')).toBe('/admin');
    expect(validarCallbackAdmin('/ordenes')).toBe('/admin');
  });
});
