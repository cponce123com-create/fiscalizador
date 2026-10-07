import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { env } from '@/lib/env';
import { ErrorDeNegocio } from '@/lib/errors';
import { MAX_IMAGEN_PORTAL_BYTES, type ImagenPortal, type TipoImagenPortal } from '@/lib/portal-images';

function configuracion() {
  const cloud = env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = env.CLOUDINARY_API_KEY?.trim();
  const secret = env.CLOUDINARY_API_SECRET?.trim();
  if (!cloud || !/^[A-Za-z0-9_-]+$/.test(cloud) || !apiKey || !secret) throw new ErrorDeNegocio('Configura las tres variables de Cloudinary para subir imágenes.');
  return { cloud, apiKey, secret };
}
function firmar(params: Record<string, string>, config: ReturnType<typeof configuracion>) {
  const signature = createHash('sha256').update(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('&') + config.secret).digest('hex');
  return { ...params, api_key: config.apiKey, signature };
}
async function enviar(endpoint: string, body: FormData | URLSearchParams, config: ReturnType<typeof configuracion>) {
  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloud}/image/${endpoint}`, { method: 'POST', body, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error();
    return await response.json();
  } catch { throw new ErrorDeNegocio('Cloudinary no pudo completar la operación. Revisa la configuración e inténtalo de nuevo.'); }
}
export async function prepararImagenPortal(buffer: Buffer, tipo: TipoImagenPortal) {
  if (!buffer.length || buffer.length > MAX_IMAGEN_PORTAL_BYTES) throw new ErrorDeNegocio('Selecciona una imagen de hasta 5 MB.');
  try {
    const imagen = sharp(buffer, { limitInputPixels: 16_000_000, animated: false });
    const metadata = await imagen.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1) throw new Error();
    const orientada = imagen.rotate();
    if (tipo === 'favicon') return orientada.resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    if (tipo === 'social') return orientada.resize(1200, 630, { fit: 'cover' }).png().toBuffer();
    const size = tipo === 'logo' ? 768 : 1920;
    return orientada.resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch { throw new ErrorDeNegocio('Usa una imagen JPEG, PNG o WebP estática de hasta 16 millones de píxeles.'); }
}
export async function subirImagenPortal(buffer: Buffer, tipo: TipoImagenPortal): Promise<ImagenPortal> {
  const config = configuracion();
  const imagen = await prepararImagenPortal(buffer, tipo);
  const publicId = `fiscalizador/portal/${randomUUID()}`;
  const formato = ['favicon', 'social'].includes(tipo) ? 'png' : 'webp';
  const form = new FormData();
  const params = firmar({ public_id: publicId, timestamp: String(Math.floor(Date.now() / 1000)), type: 'upload', overwrite: 'false' }, config);
  for (const [k, v] of Object.entries(params)) form.set(k, v);
  form.set('file', new Blob([new Uint8Array(imagen)], { type: `image/${formato}` }), `${tipo}.${formato}`);
  const data = z.object({ public_id: z.literal(publicId), resource_type: z.literal('image'), type: z.literal('upload'), format: z.literal(formato), version: z.number().int().positive() }).safeParse(await enviar('upload', form, config));
  if (!data.success) {
    try { await retirarImagenPortal({ publicId, cloud: config.cloud }); } catch { /* Limpieza del ID generado, nunca de IDs recibidos. */ }
    throw new ErrorDeNegocio('Cloudinary no confirmó una imagen válida. Se conserva la imagen anterior.');
  }
  return { publicId, cloud: config.cloud, url: `https://res.cloudinary.com/${config.cloud}/image/upload/v${data.data.version}/${publicId}.${formato}`, credito: '' };
}
export async function retirarImagenPortal(imagen: Pick<ImagenPortal, 'publicId' | 'cloud'>) {
  if (!imagen.publicId || !imagen.cloud) return;
  const config = configuracion();
  if (imagen.cloud !== config.cloud || !/^fiscalizador\/portal\/[a-f0-9-]{36}$/.test(imagen.publicId)) throw new ErrorDeNegocio('La imagen pertenece a otra configuración de Cloudinary.');
  const body = new URLSearchParams(firmar({ public_id: imagen.publicId, type: 'upload', invalidate: 'true', timestamp: String(Math.floor(Date.now() / 1000)) }, config));
  const resultado = z.object({ result: z.enum(['ok', 'not found']) }).safeParse(await enviar('destroy', body, config));
  if (!resultado.success) throw new ErrorDeNegocio('Cloudinary no confirmó la retirada de la imagen anterior.');
}
