import { contextoLocal } from '@/services/contextService';

export const runtime = 'nodejs';
export async function GET() {
  const datos = await contextoLocal();
  // Una consulta fallida del dólar no debe quedarse pegada en navegador o CDN.
  return Response.json(datos, { headers: { 'Cache-Control': datos.dolar ? 'public, max-age=60, s-maxage=60' : 'no-store' } });
}
