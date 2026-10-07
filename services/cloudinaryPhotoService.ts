import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { env } from '@/lib/env';
import { ErrorDeNegocio } from '@/lib/errors';

const CARPETA = 'fiscalizador/private-profiles';
const esquemaRespuesta = z.object({ asset_id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/), public_id: z.string(), type: z.literal('authenticated'), resource_type: z.literal('image'), format: z.literal('webp') });
function configuracion(cloud?: string) {
  const nombre = env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = env.CLOUDINARY_API_KEY?.trim();
  const secret = env.CLOUDINARY_API_SECRET?.trim();
  if (!nombre || !/^[A-Za-z0-9_-]+$/.test(nombre) || !apiKey || !secret) throw new ErrorDeNegocio('Configura CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en Render para subir y consultar fotos.');
  if (cloud && cloud !== nombre) throw new ErrorDeNegocio('Esta foto pertenece a otra cuenta de Cloudinary. Revisa CLOUDINARY_CLOUD_NAME.');
  return { nombre, apiKey, secret };
}
function parametrosFirmados(params: Record<string, string>, apiKey: string, secret: string) {
  const firma = createHash('sha256').update(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('&') + secret).digest('hex');
  return { ...params, api_key: apiKey, signature: firma };
}
function claveFoto(cloud: string, uuid: string, assetId: string) { return `cloudinary:v1:${cloud}:${uuid}:${assetId}`; }
function leerClave(key: string) {
  const partes = /^cloudinary:v1:([A-Za-z0-9_-]+):([a-f0-9-]{36}):([A-Za-z0-9_-]{1,128})$/.exec(key);
  if (!partes) throw new ErrorDeNegocio('Identificador de foto de Cloudinary inválido.');
  return { cloud: partes[1], publicId: `${CARPETA}/${partes[2]}`, assetId: partes[3] };
}
export function esFotoCloudinary(key: string) { return key.startsWith('cloudinary:'); }
async function peticion(cloud: string, endpoint: string, body: FormData | URLSearchParams) {
  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/${endpoint}`, { method: 'POST', body, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error('Cloudinary no disponible');
    return response;
  } catch { throw new ErrorDeNegocio('Cloudinary no pudo completar la operación. Revisa las credenciales y vuelve a intentarlo.'); }
}
async function retirarRecurso(config: ReturnType<typeof configuracion>, publicId: string, type = 'authenticated') {
  const body = new URLSearchParams(parametrosFirmados({ public_id: publicId, type, invalidate: 'true', timestamp: String(Math.floor(Date.now() / 1000)) }, config.apiKey, config.secret));
  const response = await peticion(config.nombre, 'image/destroy', body);
  const data = z.object({ result: z.enum(['ok', 'not found']) }).safeParse(await response.json());
  if (!data.success) throw new ErrorDeNegocio('Cloudinary no confirmó la retirada de la foto.');
}
export async function subirFotoCloudinary(imagen: Buffer) {
  const config = configuracion();
  const uuid = randomUUID();
  const publicId = `${CARPETA}/${uuid}`;
  const params = parametrosFirmados({ timestamp: String(Math.floor(Date.now() / 1000)), public_id: publicId, type: 'authenticated', overwrite: 'false' }, config.apiKey, config.secret);
  const form = new FormData();
  for (const [key, value] of Object.entries(params)) form.set(key, value);
  form.set('file', new Blob([new Uint8Array(imagen)], { type: 'image/webp' }), 'perfil.webp');
  const response = await peticion(config.nombre, 'image/upload', form);
  let data: unknown;
  try { data = await response.json(); } catch { data = null; }
  const resultado = esquemaRespuesta.safeParse(data);
  if (!resultado.success || resultado.data.public_id !== publicId) {
    const recibido = z.object({ public_id: z.literal(publicId), type: z.enum(['authenticated', 'private', 'upload']) }).safeParse(data);
    // Nunca conservar una subida inesperadamente pública ni tocar IDs ajenos.
    try { await retirarRecurso(config, publicId, recibido.success ? recibido.data.type : 'authenticated'); } catch { /* Recurso sin ficha, limpieza intentada. */ }
    throw new ErrorDeNegocio('Cloudinary no confirmó una foto protegida válida. La ficha conserva su foto anterior.');
  }
  return { key: claveFoto(config.nombre, uuid, resultado.data.asset_id), mime: 'image/webp' };
}
export async function leerFotoCloudinary(key: string) {
  const foto = leerClave(key);
  const config = configuracion(foto.cloud);
  const ahora = Math.floor(Date.now() / 1000);
  // Descarga autenticada por asset_id; la firma temporal nunca llega al navegador.
  const body = new URLSearchParams(parametrosFirmados({ asset_id: foto.assetId, timestamp: String(ahora), expires_at: String(ahora + 120), attachment: 'false' }, config.apiKey, config.secret));
  const response = await peticion(config.nombre, 'asset/download', body);
  if (response.headers.get('content-type')?.split(';')[0] !== 'image/webp') throw new ErrorDeNegocio('Cloudinary devolvió un contenido de foto inesperado.');
  return Buffer.from(await response.arrayBuffer());
}
export async function retirarFotoCloudinary(key: string) {
  const foto = leerClave(key);
  const config = configuracion(foto.cloud);
  await retirarRecurso(config, foto.publicId);
}
