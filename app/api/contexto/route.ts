import { contextoLocal } from '@/services/contextService';

export const runtime = 'nodejs';
export async function GET() {
  const datos = await contextoLocal();
  return Response.json(datos, { headers: { 'Cache-Control': datos.clima && datos.dolar ? 'public, max-age=300, s-maxage=900' : 'public, max-age=60, s-maxage=60' } });
}
