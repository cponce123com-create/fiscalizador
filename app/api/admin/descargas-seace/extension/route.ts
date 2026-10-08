import { requierePermiso } from '@/lib/auth/session';
import { respuestaDeError } from '@/lib/api/responses';
import { paqueteExtensionSeace } from '@/services/seaceExtensionService';

export const runtime = 'nodejs';
export async function GET(): Promise<Response> {
  try {
    await requierePermiso('imports:write');
    const zip = await paqueteExtensionSeace();
    return new Response(new Uint8Array(zip), { headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="Fiscalizador-SEACE-Chrome.zip"',
      'Cache-Control': 'private, no-store',
    } });
  } catch (error) { return respuestaDeError(error); }
}
