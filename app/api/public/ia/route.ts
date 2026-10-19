import { z } from 'zod';
import { leerFormularioLimitado } from '@/lib/formulario-limitado';
import { peticionPublicaLimitada } from '@/lib/public-request-limit';
import { requierePermiso } from '@/lib/auth/session';
import { leerIA, proveedorListo } from '@/services/ai/settings';
import { responderPregunta } from '@/services/ai/assistant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
export async function GET() {
  try { const c = await leerIA(); return Response.json({ disponible: c.enabled && c.publicEnabled && proveedorListo() }, { headers }); }
  catch { return Response.json({ disponible: false }, { headers }); }
}
export async function POST(request: Request) {
  return peticionPublicaLimitada('ai', request, async () => {
    try {
      const origin = request.headers.get('origin');
      if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'Consulta desde el portal.' }, { status: 403, headers });
      const config = await leerIA();
      if (!config.enabled || !proveedorListo()) return Response.json({ error: 'El asistente todavía no está habilitado. Puedes usar el buscador global.' }, { status: 503, headers });
      let publico = true;
      if (!config.publicEnabled) {
        try { await requierePermiso('settings:manage'); publico = false; }
        catch { return Response.json({ error: 'El asistente está en pruebas internas.' }, { status: 403, headers }); }
      }
      const form = await leerFormularioLimitado(request, 4096);
      const pregunta = z.string().trim().min(8).max(400).parse(form.get('pregunta'));
      return Response.json(await responderPregunta(pregunta, publico), { headers });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      const mensaje = code === 'IA_LIMITE' ? 'Se alcanzó el presupuesto del asistente. El buscador global sigue disponible.'
        : code === 'IA_NO_ADMITIDA' ? 'Puedo consultar proveedores, categorías, municipalidades y años. Reformula la pregunta con esos datos.'
        : 'No se pudo completar la consulta. Intenta una pregunta más concreta o utiliza el buscador global.';
      return Response.json({ error: mensaje }, { status: code === 'IA_LIMITE' ? 429 : 400, headers });
    }
  });
}
