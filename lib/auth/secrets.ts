import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

import { env } from '@/lib/env';

/**
 * Cifrado de secretos en reposo (hoy, el secreto TOTP de cada cuenta).
 *
 * El secreto TOTP vale tanto como la contraseña: quien lo lea puede generar códigos
 * válidos y saltarse el segundo factor. Por eso no se guarda en claro. Se usa AES-256-GCM,
 * que además **autentica**: si alguien manipula el valor guardado, el descifrado falla en
 * lugar de devolver basura.
 *
 * La clave se deriva de `AUTH_SECRET` con HKDF y una etiqueta propia, así que no hay otro
 * secreto que custodiar. Contrapartida que hay que saber: **rotar `AUTH_SECRET` invalida
 * los secretos TOTP** y esas cuentas tienen que volver a darse de alta en 2FA. Está
 * documentado en `docs/operacion.md`.
 */

const ETIQUETA = 'portal-totp-v1';
const ALGORITMO = 'aes-256-gcm';
const LONGITUD_IV = 12;

function clave(): Buffer {
  return Buffer.from(hkdfSync('sha256', env.AUTH_SECRET, 'portal-transparencia', ETIQUETA, 32));
}

/** Cifra un texto. Devuelve `iv.tag.cifrado`, cada parte en base64url. */
export function cifrar(textoPlano: string): string {
  const iv = randomBytes(LONGITUD_IV);
  const cifrador = createCipheriv(ALGORITMO, clave(), iv);
  const cifrado = Buffer.concat([cifrador.update(textoPlano, 'utf8'), cifrador.final()]);

  return [iv, cifrador.getAuthTag(), cifrado]
    .map((parte) => parte.toString('base64url'))
    .join('.');
}

/** Descifra lo que produjo `cifrar`. Lanza si el valor fue manipulado o es ilegible. */
export function descifrar(datos: string): string {
  const [iv, tag, cifrado] = datos.split('.');
  if (!iv || !tag || !cifrado) {
    throw new Error('El valor cifrado no tiene el formato esperado.');
  }

  const descifrador = createDecipheriv(ALGORITMO, clave(), Buffer.from(iv, 'base64url'));
  descifrador.setAuthTag(Buffer.from(tag, 'base64url'));

  return Buffer.concat([
    descifrador.update(Buffer.from(cifrado, 'base64url')),
    descifrador.final(),
  ]).toString('utf8');
}
