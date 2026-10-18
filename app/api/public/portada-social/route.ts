import sharp from 'sharp';
import { peticionPublicaLimitada } from '@/lib/public-request-limit';
import { leerConfiguracionPortal } from '@/services/portalService';
import { renderizarPortadaSocial } from '@/services/portalShareImage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function logoPublico(): Promise<string | undefined> {
  try {
    const { logo } = await leerConfiguracionPortal();
    if (!logo) return;
    const url = new URL(logo);
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.username || url.password || url.port) return;
    const response = await fetch(url, { signal: AbortSignal.timeout(4000), redirect: 'error', next: { revalidate: 300 } });
    if (!response.ok || !response.body) return;
    const reader = response.body.getReader();
    const partes: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 5 * 1024 * 1024) { await reader.cancel(); return; }
        partes.push(value);
      }
    } finally { reader.releaseLock(); }
    // Cloudinary almacena el logo como WebP; Satori recibe un PNG compatible.
    const png = await sharp(Buffer.concat(partes), { limitInputPixels: 16_000_000, animated: false }).resize(200, 200, { fit: 'inside' }).png().toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch { return; } // La tarjeta sigue disponible si falla el proveedor de imágenes.
}

// Una sola pieza por proceso: evita consultar Neon y rasterizar en cada visita del bot.
let cache: { vence: number; png: ArrayBuffer; headers: Headers } | undefined;
let pendiente: Promise<NonNullable<typeof cache>> | undefined;
async function pieza() {
  if (cache && cache.vence > Date.now()) return cache;
  if (!pendiente) pendiente = (async () => {
    const imagen = renderizarPortadaSocial(await logoPublico());
    cache = { vence: Date.now() + 300_000, png: await imagen.arrayBuffer(), headers: imagen.headers };
    return cache;
  })().finally(() => { pendiente = undefined; });
  return pendiente;
}

export async function GET(request: Request) {
  return peticionPublicaLimitada('image', request, async () => {
    const imagen = await pieza();
    return new Response(imagen.png.slice(0), { headers: imagen.headers });
  });
}
