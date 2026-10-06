import { describe, expect, it } from 'vitest';

import {
  base32ADatos,
  datosABase32,
  generarCodigo,
  generarSecreto,
  urlOtpAuth,
  verificarCodigo,
} from '@/lib/auth/totp';

/**
 * Pruebas del TOTP.
 *
 * Lo importante aquí son los **vectores de prueba del RFC 6238** (apéndice B): son la
 * referencia oficial del algoritmo, así que si coinciden, la implementación es correcta.
 * El resto de pruebas cubren lo que el RFC no fija: la ventana de tolerancia, el formato
 * del código y la URL de alta.
 *
 * El secreto de los vectores es la cadena ASCII `12345678901234567890`, que en base32 es
 * la que aparece abajo.
 */
const SECRETO_RFC = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('RFC 6238 (apéndice B, SHA-1, 8 dígitos)', () => {
  const vectores: [number, string][] = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ];

  for (const [instante, esperado] of vectores) {
    it(`t=${instante} → ${esperado}`, () => {
      expect(generarCodigo(SECRETO_RFC, instante * 1000, { digitos: 8 })).toBe(esperado);
    });
  }
});

describe('base32', () => {
  it('hace el viaje de ida y vuelta', () => {
    const datos = Buffer.from('12345678901234567890', 'ascii');

    expect(datosABase32(datos)).toBe(SECRETO_RFC);
    expect(base32ADatos(SECRETO_RFC)).toEqual(datos);
  });

  it('ignora separadores y relleno', () => {
    expect(base32ADatos('GEZD GNBV-GY3TQOJQ==')).toEqual(
      base32ADatos('GEZDGNBVGY3TQOJQ'),
    );
  });

  it('rechaza caracteres que no son base32', () => {
    expect(() => base32ADatos('GEZD1NBV')).toThrow(/base32/);
  });
});

describe('generarSecreto', () => {
  it('genera 160 bits en base32 (32 caracteres)', () => {
    expect(generarSecreto()).toHaveLength(32);
  });

  it('no repite el secreto', () => {
    expect(generarSecreto()).not.toBe(generarSecreto());
  });
});

describe('verificarCodigo', () => {
  const secreto = generarSecreto();
  const ahora = 1_800_000_000_000;

  it('acepta el código del momento', () => {
    expect(verificarCodigo(secreto, generarCodigo(secreto, ahora), ahora)).toBe(true);
  });

  it('acepta el código del periodo anterior y del siguiente (tolerancia de reloj)', () => {
    expect(verificarCodigo(secreto, generarCodigo(secreto, ahora - 30_000), ahora)).toBe(true);
    expect(verificarCodigo(secreto, generarCodigo(secreto, ahora + 30_000), ahora)).toBe(true);
  });

  it('rechaza el código de dos periodos atrás', () => {
    expect(verificarCodigo(secreto, generarCodigo(secreto, ahora - 90_000), ahora)).toBe(false);
  });

  it('rechaza un código de otro secreto', () => {
    const otro = generarSecreto();

    expect(verificarCodigo(secreto, generarCodigo(otro, ahora), ahora)).toBe(false);
  });

  it('rechaza un código con la longitud equivocada o vacío', () => {
    expect(verificarCodigo(secreto, '123', ahora)).toBe(false);
    expect(verificarCodigo(secreto, '', ahora)).toBe(false);
  });

  it('admite el código con espacios (como lo pega la gente)', () => {
    const codigo = generarCodigo(secreto, ahora);

    expect(verificarCodigo(secreto, `${codigo.slice(0, 3)} ${codigo.slice(3)}`, ahora)).toBe(true);
  });
});

describe('urlOtpAuth', () => {
  it('construye una URL otpauth con emisor, algoritmo y periodo', () => {
    const url = urlOtpAuth({
      secreto: SECRETO_RFC,
      cuenta: 'admin@example.org',
      emisor: 'Portal de Transparencia',
    });

    expect(url.startsWith('otpauth://totp/')).toBe(true);
    expect(url).toContain('secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(url).toContain('algorithm=SHA1');
    expect(url).toContain('digits=6');
    expect(url).toContain('period=30');
    expect(decodeURIComponent(url)).toContain('Portal de Transparencia:admin@example.org');
  });
});
