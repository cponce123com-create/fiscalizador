import { peticionPublicaLimitada } from '@/lib/public-request-limit';
import { prepararTarjetaPublica } from '@/services/shareService';
import { renderizarTarjeta } from '@/services/shareImageService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ tipo: string; id: string }> }) {
  return peticionPublicaLimitada('image', request, async () => {
    try {
      const { tipo, id } = await params;
      const tarjeta = await prepararTarjetaPublica(tipo, id, new URL(request.url).searchParams.get('municipalidad'));
      if (!tarjeta) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
      // Materializa el PNG dentro del límite de concurrencia (ImageResponse transmite de forma diferida).
      const imagen = renderizarTarjeta(tarjeta);
      // Estas tarjetas son públicas y sus URL son estables. Permitir caché del
      // navegador/plataforma evita volver a rasterizar y transferir el PNG cada vez
      // que WhatsApp, Facebook o un visitante reabre el mismo enlace.
      const headers = new Headers(imagen.headers);
      headers.set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600');
      return new Response(await imagen.arrayBuffer(), { headers });
    } catch { return Response.json({ error: 'No se pudo preparar la imagen.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
  });
}
