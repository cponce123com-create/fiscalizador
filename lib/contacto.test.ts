import { describe, expect, it } from 'vitest';

import { CONTACTO_CORRECCIONES_PREDETERMINADO, PLAZO_RESPUESTA_DIAS, leerContactoCorrecciones } from '@/lib/contacto';

/**
 * Pruebas de la lectura del correo de correcciones.
 *
 * La variable permite reemplazar el correo sin editar código. Si falta, el
 * canal público acordado sigue disponible y la página nunca queda sin contacto.
 */
describe('leerContactoCorrecciones', () => {
  it('devuelve el correo cuando está definido', () => {
    expect(leerContactoCorrecciones('correcciones@example.org')).toBe('correcciones@example.org');
  });

  it('recorta los espacios sobrantes', () => {
    expect(leerContactoCorrecciones('  correcciones@example.org  ')).toBe(
      'correcciones@example.org',
    );
  });

  it('usa el correo público predeterminado ante una cadena vacía', () => {
    expect(leerContactoCorrecciones('')).toBe(CONTACTO_CORRECCIONES_PREDETERMINADO);
  });

  it('usa el correo público predeterminado ante una cadena en blanco', () => {
    expect(leerContactoCorrecciones('   ')).toBe(CONTACTO_CORRECCIONES_PREDETERMINADO);
  });

  it('usa el correo público predeterminado si la variable está ausente', () => {
    expect(leerContactoCorrecciones(undefined)).toBe(CONTACTO_CORRECCIONES_PREDETERMINADO);
  });
});

describe('PLAZO_RESPUESTA_DIAS', () => {
  it('es un plazo positivo', () => {
    expect(PLAZO_RESPUESTA_DIAS).toBeGreaterThan(0);
  });
});
