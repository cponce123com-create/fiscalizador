import { revalidatePath } from 'next/cache';
import { requierePermiso, SinPermiso } from '@/lib/auth/session';
import { respuestaDeError } from '@/lib/api/responses';
import { ErrorDeNegocio } from '@/lib/errors';
import { leerFormularioLimitado } from '@/lib/formulario-limitado';
import { claveImagenPortal, esquemaImagenPortal, esquemaTipoImagenPortal, MAX_IMAGEN_PORTAL_BYTES, type ImagenPortal } from '@/lib/portal-images';
import { prisma } from '@/lib/prisma';
import { registrarAuditoria } from '@/services/auditService';
import { retirarImagenPortal, subirImagenPortal } from '@/services/portalImageStorage';

export const runtime = 'nodejs';
type Contexto = { params: Promise<{ tipo: string }> };
async function cambiar(request: Request, contexto: Contexto, borrar: boolean) {
  let nueva: ImagenPortal | null = null;
  try {
    const usuario = await requierePermiso('settings:manage');
    const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? new URL(request.url).host).split(',')[0].trim();
    let origin: URL;
    try { origin = new URL(request.headers.get('origin') ?? ''); } catch { throw new SinPermiso('Modifica las imágenes desde el panel.'); }
    if (!['http:', 'https:'].includes(origin.protocol) || origin.host !== host) throw new SinPermiso('Modifica las imágenes desde el panel.');
    const tipoValidado = esquemaTipoImagenPortal.safeParse((await contexto.params).tipo);
    if (!tipoValidado.success) throw new ErrorDeNegocio('Tipo de imagen no válido.');
    const tipo = tipoValidado.data;
    if (!borrar) {
      const form = await leerFormularioLimitado(request, MAX_IMAGEN_PORTAL_BYTES + 64 * 1024);
      const archivo = form.get('imagen');
      const credito = String(form.get('credito') ?? '').trim();
      if (!(archivo instanceof File) || !archivo.size || archivo.size > MAX_IMAGEN_PORTAL_BYTES) throw new ErrorDeNegocio('Selecciona una imagen de hasta 5 MB.');
      if (credito.length > 180 || (tipo === 'portada' && !credito)) throw new ErrorDeNegocio('Indica el lugar y el crédito de la fotografía (hasta 180 caracteres).');
      nueva = await subirImagenPortal(Buffer.from(await archivo.arrayBuffer()), tipo);
      nueva.credito = tipo === 'portada' ? credito : '';
    }
    const key = claveImagenPortal(tipo);
    const imagen = nueva ?? { url: '', publicId: null, cloud: null, credito: '' };
    const anterior = await prisma.$transaction(async tx => {
      // Serializa sustituciones de una misma imagen; los titulares se guardan por separado.
      // La función devuelve void, un tipo que el adapter de Prisma no deserializa.
      // Se adquiere el mismo bloqueo devolviendo únicamente una columna entera.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${key}))`;
      const previo = await tx.appSetting.findUnique({ where: { key } });
      await tx.appSetting.upsert({ where: { key }, create: { key, value: imagen }, update: { value: imagen } });
      await registrarAuditoria(tx, { userId: usuario.id, action: 'CHANGE_SETTINGS', entity: 'AppSetting', entityId: key, metadata: { tipo, retirada: borrar, url: imagen.url } });
      const parsed = esquemaImagenPortal.safeParse(previo?.value);
      return parsed.success ? parsed.data : null;
    });
    nueva = null;
    let aviso: string | null = null;
    if (anterior?.publicId) {
      try { await retirarImagenPortal(anterior); } catch { aviso = 'El cambio se guardó, pero no se pudo retirar el recurso anterior de Cloudinary.'; }
    }
    revalidatePath('/', 'layout');
    revalidatePath('/admin/apariencia');
    return Response.json({ ok: true, url: imagen.url, aviso });
  } catch (error) {
    if (nueva) { try { await retirarImagenPortal(nueva); } catch { /* Limpieza intentada si la transacción falla. */ } }
    return respuestaDeError(error);
  }
}
export async function POST(request: Request, contexto: Contexto) { return cambiar(request, contexto, false); }
export async function DELETE(request: Request, contexto: Contexto) { return cambiar(request, contexto, true); }
