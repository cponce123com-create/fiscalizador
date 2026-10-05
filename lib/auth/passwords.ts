import { hash, verify } from '@node-rs/argon2';

/**
 * Hashing de contraseñas.
 *
 * Se usa **argon2id**, el ganador del Password Hashing Competition y la
 * recomendación actual de OWASP para contraseñas nuevas. Se prefiere sobre
 * bcrypt porque es resistente a ataques con GPU y FPGA.
 *
 * Se usa `@node-rs/argon2` (implementación en Rust con binarios precompilados)
 * en lugar de `argon2` (node-gyp): no requiere compilar código nativo durante el
 * despliegue, que es justo el paso que suele romper en plataformas como Render.
 */

/** Longitud mínima exigida a una contraseña nueva. */
export const LONGITUD_MINIMA_PASSWORD = 12;

export async function hashearPassword(password: string): Promise<string> {
  // Parámetros por defecto de @node-rs/argon2: argon2id, 19 MiB, t=2, p=1.
  return hash(password);
}

/**
 * Verifica una contraseña contra su hash.
 *
 * Devuelve `false` ante un hash mal formado en lugar de lanzar: un hash corrupto
 * en la base de datos no debe provocar un error 500 que revele información.
 */
export async function verificarPassword(hashAlmacenado: string, password: string): Promise<boolean> {
  try {
    return await verify(hashAlmacenado, password);
  } catch {
    return false;
  }
}

/**
 * Valida la fortaleza mínima de una contraseña nueva.
 *
 * Deliberadamente NO se exige una composición concreta de símbolos: las reglas
 * de composición empujan a la gente a patrones predecibles. Se exige longitud.
 */
export function validarFortaleza(password: string): { ok: true } | { ok: false; motivo: string } {
  if (password.length < LONGITUD_MINIMA_PASSWORD) {
    return {
      ok: false,
      motivo: `La contraseña debe tener al menos ${LONGITUD_MINIMA_PASSWORD} caracteres.`,
    };
  }
  if (/^(.)\1+$/.test(password)) {
    return { ok: false, motivo: 'La contraseña no puede ser un solo carácter repetido.' };
  }
  return { ok: true };
}
