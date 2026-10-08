import { peticionPublicaLimitada } from '@/lib/public-request-limit';
import { prepararTarjetaPublica } from '@/services/shareService';
import { renderizarTarjeta } from '@/services/shareImageService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ tipo: string; id: string }> }) {
  return peticionPublicaLimitada('image', async () => {
    try {
      const { tipo, id } = await params;
      const tarjeta = await prepararTarjetaPublica(tipo, id);
      if (!tarjeta) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
      // Materializa el PNG dentro del límite de concurrencia (ImageResponse transmite de forma diferida).
      const imagen = renderizarTarjeta(tarjeta);
      return new Response(await imagen.arrayBuffer(), { headers: imagen.headers });
    } catch { return Response.json({ error: 'No se pudo preparar la imagen.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
  });
}
