import { prisma } from '@/lib/prisma';
import { cabeceraDescarga, nombreDescargaLibro } from '@/lib/book-download';
import { leerConfiguracionPortal } from '@/services/portalService';
import { leerOriginalVerificado, originalPublicado, tieneColumnasPrivadas } from '@/services/bookPublicationService';
import { extensionSegura } from '@/services/storageService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const libro = await prisma.importBatch.findUnique({ where: { id }, select: { id: true, status: true, storageKey: true, originalFilename: true, checksum: true, year: true, month: true, importType: true, version: true } });
  if (!libro || !['COMPLETED', 'COMPLETED_WITH_WARNINGS'].includes(libro.status) || !await originalPublicado(id)) return new Response('El archivo original no está publicado para descarga.', { status: 404 });
  if (await tieneColumnasPrivadas(id)) return new Response('El original contiene columnas restringidas. Puedes descargar el extracto público.', { status: 403 });
  if (!libro.storageKey) return new Response('El original no está disponible. Consulta la fuente o descarga el extracto público.', { status: 410 });
  try {
    const archivo = await leerOriginalVerificado(libro.storageKey, libro.checksum);
    const extension = extensionSegura(libro.originalFilename).slice(1);
    const config = await leerConfiguracionPortal();
    const tipos: Record<string, string> = { xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel', csv: 'text/csv' };
    return new Response(new Uint8Array(archivo), { headers: { 'Content-Type': tipos[extension], 'Content-Disposition': cabeceraDescarga(nombreDescargaLibro(libro, config.municipio, extension)), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    return new Response('No se pudo recuperar o verificar el original. Consulta la fuente o descarga el extracto público. El administrador debe revisar el almacenamiento.', { status: 410 });
  }
}
