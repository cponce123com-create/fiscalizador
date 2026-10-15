import { peticionPublicaLimitada } from '@/lib/public-request-limit';
import { buscarProveedoresGlobal } from '@/services/globalSearchService';

export const runtime = 'nodejs';

async function atender(request: Request): Promise<Response> {
  const texto = new URL(request.url).searchParams.get('texto')?.trim() ?? '';
  try {
    return Response.json(await buscarProveedoresGlobal(texto), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'No se pudo completar la búsqueda global.' }, { status: 503 });
  }
}

export async function GET(...args: Parameters<typeof atender>): Promise<Response> {
  return peticionPublicaLimitada('search', () => atender(...args));
}
