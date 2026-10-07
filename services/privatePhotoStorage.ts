import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { env } from '@/lib/env';
import { ErrorDeNegocio } from '@/lib/errors';

export const MAX_FOTO_BYTES = 2 * 1024 * 1024;
export function tipoFoto(buffer: Buffer): { mime: string; extension: string } {
  if (!buffer.length || buffer.length > MAX_FOTO_BYTES) throw new ErrorDeNegocio('La foto debe pesar como máximo 2 MB.');
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mime: 'image/png', extension: 'png' };
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return { mime: 'image/jpeg', extension: 'jpg' };
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return { mime: 'image/webp', extension: 'webp' };
  throw new ErrorDeNegocio('Selecciona una imagen JPEG, PNG o WebP válida.');
}
function rutaFoto(key: string): string {
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(key)) throw new ErrorDeNegocio('Identificador de foto inválido.');
  return path.join(path.resolve(env.STORAGE_LOCAL_DIR), 'private-profiles', key);
}
export async function guardarFotoPrivada(buffer: Buffer) {
  tipoFoto(buffer);
  let imagen: Buffer;
  try {
    imagen = await sharp(buffer, { limitInputPixels: 16_000_000, animated: false }).rotate().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch { throw new ErrorDeNegocio('La foto no se pudo leer. Usa una imagen JPEG, PNG o WebP de hasta 16 millones de píxeles.'); }
  const key = `${randomUUID()}.webp`;
  const destino = rutaFoto(key);
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, imagen, { flag: 'wx' });
  return { key, mime: 'image/webp' };
}
export async function leerFotoPrivada(key: string) { return readFile(rutaFoto(key)); }
export async function retirarFotoPrivada(key: string) { await unlink(rutaFoto(key)); }
