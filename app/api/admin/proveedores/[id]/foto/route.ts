import { revalidatePath } from 'next/cache';
import { esquemaPublicacionProveedor, fuentePublica, datoProveedorPublicado } from '@/lib/supplier-profile';
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
async function cambiarFoto(request: Request, { params }: Contexto, operacion: 'subir' | 'retirar' | 'publicar') {
  let nueva: { key: string; mime: string } | null = null;
  try {
    const usuario = await requierePermiso('persons:write');
    verificarOrigen(request);
    const { id } = await params;
    const borrar = operacion === 'retirar';
    if (!borrar && Number(request.headers.get('content-length')) > MAX_FOTO_BYTES + 64 * 1024) throw new ErrorDeNegocio('La foto debe pesar como máximo 2 MB.');
    const form = borrar ? null : await request.formData();
    const publicar = form?.has('publicar') ?? false;
    const sourceUrl = publicar ? String(form?.get('sourceUrl') ?? '').trim() : null;
    if (publicar && !fuentePublica.safeParse(sourceUrl).success) throw new ErrorDeNegocio('Indica la fuente pública de la foto para publicarla.');
    if (operacion === 'subir') {
      const foto = form?.get('foto');
      if (!(foto instanceof File) || foto.size > MAX_FOTO_BYTES) throw new ErrorDeNegocio('Selecciona una foto de hasta 2 MB.');
      nueva = await guardarFotoPrivada(Buffer.from(await foto.arrayBuffer()));
    }
    const anterior = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Supplier" WHERE id = ${id} FOR UPDATE`;
      if (!await tx.supplier.findUnique({ where: { id }, select: { id: true } })) throw new NoEncontrado('No existe este proveedor.');
      const viejo = await tx.supplierProfile.findUnique({ where: { supplierId: id }, select: { photoKey: true, publication: true, isPublic: true, updatedAt: true } });
      const reglas = esquemaPublicacionProveedor.safeParse(viejo?.publication);
      if (operacion === 'publicar' && !viejo?.photoKey) throw new ErrorDeNegocio('Primero sube una foto.');
      if (form?.has('version') && String(form.get('version')) !== (viejo?.updatedAt.toISOString() ?? '')) throw new ErrorDeNegocio('La ficha cambió. Recarga antes de modificar la foto.');
      // Las solicitudes antiguas conservan la publicación existente al reemplazar;
      // el formulario actual expresa de forma explícita la publicación elegida.
      const explicita = form?.has('publicacionExplicita') ?? false;
      const reglaFoto = borrar ? { enabled: false, sourceUrl: null }
        : explicita ? { enabled: publicar, sourceUrl, ...(publicar ? { verifiedAt: new Date().toISOString() } : {}) }
        : (reglas.success ? reglas.data.foto : null) ?? { enabled: false, sourceUrl: null };
      const publication = { ...(reglas.success ? reglas.data : {}), foto: reglaFoto };
      const data = { publication, ...(publicar ? { isPublic: true } : {}), ...(operacion === 'publicar' ? {} : { photoKey: nueva?.key ?? null, photoMime: nueva?.mime ?? null }), updatedById: usuario.id };
      const perfil = await tx.supplierProfile.upsert({ where: { supplierId: id }, create: { supplierId: id, createdById: usuario.id, ...data }, update: data });
      await registrarAuditoria(tx, { userId: usuario.id, action: 'CHANGE_PHOTO', entity: 'SupplierProfile', entityId: perfil.id, metadata: { supplierId: id, retirada: borrar } });
      return { anterior: operacion === 'publicar' ? null : viejo?.photoKey, publicada: Boolean(perfil.photoKey && datoProveedorPublicado(perfil, 'foto')) };
    });
    nueva = null; // El archivo nuevo ya pertenece a la ficha confirmada.
    if (anterior.anterior) { try { await retirarFotoPrivada(anterior.anterior); } catch { /* La ficha ya está guardada. */ } }
    revalidatePath('/', 'layout');
    revalidatePath(`/admin/proveedores/${id}`);
    return Response.json({ ok: true, publicada: anterior.publicada });
  } catch (error) {
    if (nueva) { try { await retirarFotoPrivada(nueva.key); } catch { /* Archivo huérfano, no referencia una ficha. */ } }
    return respuestaDeError(error);
  }
}
export async function POST(request: Request, contexto: Contexto) { return cambiarFoto(request, contexto, 'subir'); }
export async function DELETE(request: Request, contexto: Contexto) { return cambiarFoto(request, contexto, 'retirar'); }

export async function PATCH(request: Request, contexto: Contexto) { return cambiarFoto(request, contexto, 'publicar'); }
