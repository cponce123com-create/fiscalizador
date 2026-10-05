import { describe, expect, it } from 'vitest';

import {
  LONGITUD_MINIMA_PASSWORD,
  hashearPassword,
  validarFortaleza,
  verificarPassword,
} from '@/lib/auth/passwords';

describe('hashing de contraseñas (argon2id)', () => {
  it('genera un hash distinto en cada llamada, aunque la contraseña sea la misma', async () => {
    // Sal aleatoria por hash: dos usuarios con la misma contraseña no comparten
    // hash, así que no se pueden comparar entre sí.
    const a = await hashearPassword('contrasena-suficientemente-larga');
    const b = await hashearPassword('contrasena-suficientemente-larga');

    expect(a).not.toBe(b);
    expect(a.startsWith('$argon2id$')).toBe(true);
  });

  it('acepta la contraseña correcta', async () => {
    const hash = await hashearPassword('contrasena-suficientemente-larga');
    await expect(verificarPassword(hash, 'contrasena-suficientemente-larga')).resolves.toBe(true);
  });

  it('rechaza la contraseña incorrecta', async () => {
    const hash = await hashearPassword('contrasena-suficientemente-larga');
    await expect(verificarPassword(hash, 'otra-contrasena-distinta')).resolves.toBe(false);
    await expect(verificarPassword(hash, '')).resolves.toBe(false);
  });

  it('rechaza mayúsculas y espacios que no coinciden exactamente', async () => {
    const hash = await hashearPassword('Contrasena-Con-Mayusculas');
    await expect(verificarPassword(hash, 'contrasena-con-mayusculas')).resolves.toBe(false);
    await expect(verificarPassword(hash, 'Contrasena-Con-Mayusculas ')).resolves.toBe(false);
  });

  it('devuelve false ante un hash corrupto en lugar de lanzar', async () => {
    // Un hash dañado en la base de datos no debe provocar un error 500 que
    // revele información sobre el estado interno.
    await expect(verificarPassword('no-es-un-hash', 'lo-que-sea')).resolves.toBe(false);
    await expect(verificarPassword('', 'lo-que-sea')).resolves.toBe(false);
    await expect(verificarPassword('$argon2id$roto', 'lo-que-sea')).resolves.toBe(false);
  });
});

describe('fortaleza de la contraseña', () => {
  it('exige la longitud mínima', () => {
    const corta = 'a'.repeat(LONGITUD_MINIMA_PASSWORD - 1);
    expect(validarFortaleza(corta).ok).toBe(false);

    // 12 caracteres distintos: cumple la longitud y no cae en la regla de
    // "un solo carácter repetido".
    const justa = 'abcdefghijkl';
    expect(justa).toHaveLength(LONGITUD_MINIMA_PASSWORD);
    expect(validarFortaleza(justa).ok).toBe(true);
  });

  it('rechaza un solo carácter repetido', () => {
    const resultado = validarFortaleza('a'.repeat(LONGITUD_MINIMA_PASSWORD));
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toContain('repetido');
  });

  it('no impone reglas de composición, solo longitud', () => {
    // Exigir símbolos empuja a patrones predecibles; una frase larga es mejor.
    expect(validarFortaleza('correcto caballo bateria grapa').ok).toBe(true);
    expect(validarFortaleza('todoslosmininusculasylarga').ok).toBe(true);
  });

  it('explica el motivo del rechazo', () => {
    const resultado = validarFortaleza('corta');
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.motivo).toContain(String(LONGITUD_MINIMA_PASSWORD));
    }
  });
});
