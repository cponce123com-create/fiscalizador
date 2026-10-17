import { respuestaDeError, okJson } from '@/lib/api/responses';
import { requierePermiso } from '@/lib/auth/session';
import { reanalizarLote } from '@/services/importService';

export const runtime = 'nodejs';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requierePermiso('imports:write');
    const { id } = await context.params;
    const response = okJson(await reanalizarLote(id));
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (error) {
    return respuestaDeError(error);
  }
}
