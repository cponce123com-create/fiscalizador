import { peticionPublicaLimitada } from '@/lib/public-request-limit';
import { registrarBusquedaPublica } from '@/services/publicSearchTermsService';

export const runtime = 'nodejs';

async function atender(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const texto = typeof body?.texto === 'string' ? body.texto : '';
    const registrada = await registrarBusquedaPublica(texto);
    return Response.json({ ok: registrada }, { status: registrada ? 200 : 400, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'No se pudo registrar la búsqueda.' }, { status: 400 });
  }
}

export async function POST(...args: Parameters<typeof atender>): Promise<Response> {
  return peticionPublicaLimitada('search', () => atender(...args));
}
