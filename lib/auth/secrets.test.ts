import { describe, expect, it } from 'vitest';

import { cifrar, descifrar } from '@/lib/auth/secrets';

/**
 * Pruebas del cifrado de secretos.
 *
 * Lo que importa comprobar no es solo que el viaje de ida y vuelta funcione, sino que el
 * valor guardado **no contenga el secreto** y que una manipulación se detecte en vez de
 * devolver basura.
 */
describe('cifrado de secretos', () => {
  const secreto = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

  it('descifra lo que cifró', () => {
    expect(descifrar(cifrar(secreto))).toBe(secreto);
  });

  it('no deja el texto en claro dentro del valor cifrado', () => {
    expect(cifrar(secreto)).not.toContain(secreto);
  });

  it('cifra distinto cada vez (el IV es aleatorio)', () => {
    expect(cifrar('el mismo texto')).not.toBe(cifrar('el mismo texto'));
  });

  it('falla si el valor fue manipulado', () => {
    const [iv, , cifrado] = cifrar('secreto-uno').split('.');
    const [, etiquetaDeOtro] = cifrar('secreto-dos').split('.');

    // Texto cifrado de uno con la etiqueta de autenticación de otro: GCM debe rechazarlo.
    expect(() => descifrar([iv, etiquetaDeOtro, cifrado].join('.'))).toThrow();
  });

  it('falla con un formato inesperado', () => {
    expect(() => descifrar('esto-no-es-un-valor-cifrado')).toThrow(/formato/);
  });
});
