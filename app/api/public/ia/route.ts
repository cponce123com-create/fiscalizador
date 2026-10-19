import { errorIA } from '@/services/ai/errors';
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
      const origenes = new Set([new URL(request.url).origin]);
      // Render puede exponer una URL interna al servidor. Solo confiar además en la URL configurada.
      try { if (process.env.NEXT_PUBLIC_SITE_URL) origenes.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).origin); } catch { /* no ampliar con una URL inválida */ }
      if (origin && !origenes.has(origin)) return Response.json({ error: 'Consulta desde el portal.' }, { status: 403, headers });
      const config = await leerIA();
      if (!proveedorListo()) return Response.json({ error: 'Falta configurar AI_API_KEY o AI_MODEL en Render y desplegar los cambios.', code: 'IA_CONFIG' }, { status: 503, headers });
      if (!config.enabled) return Response.json({ error: 'El asistente está desactivado. En Admin → IA marca Activar asistente y guarda la configuración.', code: 'IA_DESACTIVADA' }, { status: 503, headers });
      let publico = true;
      if (!config.publicEnabled) {
        try { await requierePermiso('settings:manage'); publico = false; }
        catch { return Response.json({ error: 'El asistente está en pruebas internas.' }, { status: 403, headers }); }
      }
      const form = await leerFormularioLimitado(request, 4096);
      const pregunta = z.string().trim().min(8).max(400).parse(form.get('pregunta'));
      return Response.json(await responderPregunta(pregunta, publico), { headers });
    } catch (error) {
      const detalle = errorIA(error);
      return Response.json({ error: detalle.mensaje, code: detalle.code }, { status: detalle.status, headers });
    }
  });
}
