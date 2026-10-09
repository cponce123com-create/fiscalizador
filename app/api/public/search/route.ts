import { peticionPublicaLimitada } from '@/lib/public-request-limit';
import { buscarEnPortal } from '@/services/searchService';

export const runtime = 'nodejs';

/** Solo campos del listado público; nunca fichas privadas de proveedores. */
async function atender(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const texto = params.get('texto')?.trim() ?? '';
  const municipalidad = params.get('municipalidad');
  try {
    const resultado = await buscarEnPortal(texto, municipalidad);
    return Response.json(resultado, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'No se pudo completar la búsqueda.' }, { status: 503 });
  }
}

export async function GET(...args: Parameters<typeof atender>): Promise<Response> {
  return peticionPublicaLimitada('search', () => atender(...args));
}
