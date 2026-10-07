import { requierePermiso, SinPermiso } from '@/lib/auth/session';
import { respuestaDeError } from '@/lib/api/responses';
import { ErrorDeNegocio, NoEncontrado } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { guardarFotoPrivada, leerFotoPrivada, retirarFotoPrivada, MAX_FOTO_BYTES } from '@/services/privatePhotoStorage';
import { registrarAuditoria } from '@/services/auditService';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Contexto = { params: Promise<{ id: string }> };
function verificarOrigen(request: Request) {
  let origin: URL;
  try { origin = new URL(request.headers.get('origin') ?? ''); }
  catch { throw new SinPermiso('La foto solo puede modificarse desde este panel.'); }
  // Render puede usar una URL interna: compara el host público reenviado, como Server Actions.
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? new URL(request.url).host).split(',')[0].trim();
  if (!['https:', 'http:'].includes(origin.protocol) || origin.host !== host) throw new SinPermiso('La foto solo puede modificarse desde este panel.');
}
export async function GET(_request: Request, { params }: Contexto) {
  try {
    await requierePermiso('persons:read');
    const { id } = await params;
    const perfil = await prisma.supplierProfile.findUnique({ where: { supplierId: id }, select: { photoKey: true, photoMime: true } });
    if (!perfil?.photoKey) throw new NoEncontrado('No hay foto en este perfil.');
    let bytes: Buffer;
    try { bytes = await leerFotoPrivada(perfil.photoKey); } catch { throw new NoEncontrado('La foto no está disponible en el almacenamiento.'); }
    return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': perfil.photoMime ?? 'application/octet-stream', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' } });
  } catch (error) { return respuestaDeError(error); }
}
async function cambiarFoto(request: Request, { params }: Contexto, borrar: boolean) {
  let nueva: { key: string; mime: string } | null = null;
  try {
    const usuario = await requierePermiso('persons:write');
    verificarOrigen(request);
    const { id } = await params;
    if (!borrar) {
      if (Number(request.headers.get('content-length')) > MAX_FOTO_BYTES + 64 * 1024) throw new ErrorDeNegocio('La foto debe pesar como máximo 2 MB.');
      const form = await request.formData();
      const foto = form.get('foto');
      if (!(foto instanceof File) || foto.size > MAX_FOTO_BYTES) throw new ErrorDeNegocio('Selecciona una foto de hasta 2 MB.');
      nueva = await guardarFotoPrivada(Buffer.from(await foto.arrayBuffer()));
    }
    const anterior = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Supplier" WHERE id = ${id} FOR UPDATE`;
      if (!await tx.supplier.findUnique({ where: { id }, select: { id: true } })) throw new NoEncontrado('No existe este proveedor.');
      const viejo = await tx.supplierProfile.findUnique({ where: { supplierId: id }, select: { photoKey: true } });
      const data = { photoKey: nueva?.key ?? null, photoMime: nueva?.mime ?? null, updatedById: usuario.id };
      const perfil = await tx.supplierProfile.upsert({ where: { supplierId: id }, create: { supplierId: id, createdById: usuario.id, ...data }, update: data });
      await registrarAuditoria(tx, { userId: usuario.id, action: 'CHANGE_PHOTO', entity: 'SupplierProfile', entityId: perfil.id, metadata: { supplierId: id, retirada: borrar } });
      return viejo?.photoKey;
    });
    nueva = null; // El archivo nuevo ya pertenece a la ficha confirmada.
    if (anterior) { try { await retirarFotoPrivada(anterior); } catch { /* La ficha ya está guardada. */ } }
    return Response.json({ ok: true });
  } catch (error) {
    if (nueva) { try { await retirarFotoPrivada(nueva.key); } catch { /* Archivo huérfano, no referencia una ficha. */ } }
    return respuestaDeError(error);
  }
}
export async function POST(request: Request, contexto: Contexto) { return cambiarFoto(request, contexto, false); }
export async function DELETE(request: Request, contexto: Contexto) { return cambiarFoto(request, contexto, true); }
