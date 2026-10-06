import { describe, expect, it } from 'vitest';

import { PLAZO_RESPUESTA_DIAS, leerContactoCorrecciones } from '@/lib/contacto';

/**
 * Pruebas de la lectura del correo de correcciones.
 *
 * Lo que se comprueba es que **no se inventa un valor**: si la variable falta o
 * está en blanco, la página debe poder distinguirlo para avisar en lugar de
 * mostrar un correo inexistente.
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

  it('trata la cadena vacía como no configurado', () => {
    expect(leerContactoCorrecciones('')).toBeNull();
  });

  it('trata una cadena en blanco como no configurado', () => {
    expect(leerContactoCorrecciones('   ')).toBeNull();
  });

  it('trata la variable ausente como no configurado', () => {
    expect(leerContactoCorrecciones(undefined)).toBeNull();
  });
});

describe('PLAZO_RESPUESTA_DIAS', () => {
  it('es un plazo positivo', () => {
    expect(PLAZO_RESPUESTA_DIAS).toBeGreaterThan(0);
  });
});
