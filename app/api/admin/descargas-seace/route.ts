import { z } from 'zod';
import { respuestaDeError } from '@/lib/api/responses';
import { requierePermiso, SinPermiso } from '@/lib/auth/session';
import { crearDescarga, descargarMes, eliminarDescarga, obtenerDescarga, ultimaDescarga, zipDescarga } from '@/services/seaceDownloadService';

export const runtime = 'nodejs';
export const maxDuration = 120;
function origen(request: Request) {
  const host = request.headers.get('host');
  let origin: URL;
  try { origin = new URL(request.headers.get('origin') ?? ''); } catch { throw new SinPermiso('Usa las descargas desde el panel.'); }
  if (!['http:', 'https:'].includes(origin.protocol) || origin.host !== host) throw new SinPermiso('Usa las descargas desde el panel.');
}
const entrada = z.discriminatedUnion('accion', [
  z.object({ accion: z.literal('crear'), anio: z.number().int() }).strict(),
  z.object({ accion: z.literal('mes'), id: z.string().uuid(), mes: z.number().int().min(1).max(12) }).strict(),
  z.object({ accion: z.literal('eliminar'), id: z.string().uuid() }).strict(),
]);
export async function GET(request: Request) {
  try {
    const usuario = await requierePermiso('imports:write');
    const params = new URL(request.url).searchParams;
    const id = params.get('id');
    if (params.get('zip') === '1' && id) return await zipDescarga(usuario.id, id);
    return Response.json(id ? await obtenerDescarga(usuario.id, id) : await ultimaDescarga(usuario.id), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return respuestaDeError(error); }
}
export async function POST(request: Request) {
  try {
    const usuario = await requierePermiso('imports:write'); origen(request);
    const reader = request.body?.getReader();
    const partes: Uint8Array[] = []; let bytes = 0;
    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          bytes += value.byteLength;
          if (bytes > 2048) return Response.json({ error: 'Solicitud demasiado grande.' }, { status: 413 });
          partes.push(value);
        }
      } finally { await reader.cancel(); }
    }
    const texto = Buffer.concat(partes).toString('utf8');
    let json: unknown;
    try { json = JSON.parse(texto); } catch { return Response.json({ error: 'Solicitud inválida.' }, { status: 400 }); }
    const dato = entrada.safeParse(json);
    if (!dato.success) return Response.json({ error: 'Solicitud inválida.' }, { status: 400 });
    const accion = dato.data;
    if (accion.accion === 'crear') return Response.json(await crearDescarga(usuario.id, accion.anio), { status: 201 });
    if (accion.accion === 'mes') return Response.json(await descargarMes(usuario.id, accion.id, accion.mes));
    await eliminarDescarga(usuario.id, accion.id);
    return Response.json({ eliminado: true });
  } catch (error) { return respuestaDeError(error); }
}
