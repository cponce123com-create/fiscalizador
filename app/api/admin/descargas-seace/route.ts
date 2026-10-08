import { z } from 'zod';
import { requierePermiso, SinPermiso } from '@/lib/auth/session';
import { respuestaDeError } from '@/lib/api/responses';
import { descargarExcelSeace } from '@/services/seaceHttpService';

export const runtime = 'nodejs';
export const maxDuration = 60;
const entrada = z.object({ anio: z.number().int(), mes: z.number().int().min(1).max(12), ruc: z.string().regex(/^\d{11}$/), municipio: z.string().trim().min(1).max(120) }).strict();
export async function POST(request: Request) {
  try {
    const usuario = await requierePermiso('imports:write');
    const host = request.headers.get('host') ?? new URL(request.url).host;
    let origin: URL;
    try { origin = new URL(request.headers.get('origin') ?? ''); } catch { throw new SinPermiso('Descarga desde el panel del administrador.'); }
    if (!['http:', 'https:'].includes(origin.protocol) || origin.host !== host) throw new SinPermiso('Descarga desde el panel del administrador.');
    const reader = request.body?.getReader();
    const partes: Uint8Array[] = []; let total = 0;
    if (reader) try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        total += value.byteLength;
        if (total > 2048) return Response.json({ error: 'Solicitud demasiado grande.' }, { status: 413 });
        partes.push(value);
      }
    } finally { await reader.cancel(); }
    let json: unknown;
    try { json = JSON.parse(Buffer.concat(partes).toString('utf8')); } catch { return Response.json({ error: 'Solicitud inválida.' }, { status: 400 }); }
    const dato = entrada.safeParse(json);
    if (!dato.success) return Response.json({ error: 'Año, mes, RUC o municipalidad inválidos.' }, { status: 400 });
    const { anio, mes, ruc, municipio } = dato.data;
    const archivo = await descargarExcelSeace(usuario.id, anio, mes, ruc, municipio);
    return new Response(new Uint8Array(archivo.bytes), { headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${archivo.filename}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return respuestaDeError(error); }
}
