import Link from 'next/link';
import { tituloLibro } from '@/lib/book-download';
import { leerConfiguracionPortal } from '@/services/portalService';
import { claveOriginal, esOriginalPublicado } from '@/services/bookPublicationService';
import { prisma } from '@/lib/prisma';
import { formatearFechaHora } from '@/lib/utils';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Fuentes y cobertura' };
export default async function Fuentes() {
  const lotes = await prisma.importBatch.findMany({
    where: { status: { in: ['COMPLETED', 'COMPLETED_WITH_WARNINGS'] } },
    orderBy: [{ year: 'desc' }, { month: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      year: true,
      month: true,
      importType: true,
      version: true,
      isCurrent: true,
      requiresReview: true,
      coverageComplete: true,
      sourceUrl: true,
      sheetName: true,
      checksum: true,
      originalFilename: true,
      processingFinishedAt: true,
      successfulRows: true,
      errorRows: true,
      excludedRows: true,
      warningRows: true,
    },
  });
  const [config, ajustes] = await Promise.all([
    leerConfiguracionPortal(),
    prisma.appSetting.findMany({ where: { key: { in: lotes.map(l => claveOriginal(l.id)) } } }),
  ]);
  const publicados = new Set(ajustes.filter(a => esOriginalPublicado(a.value)).map(a => a.key));
  const anios = [...new Set(lotes.map((b) => b.year))];
  return (
    <article className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Fuentes y cobertura</h1>
      <p>
        Portal ciudadano independiente: órdenes registradas, no pagos ni presupuesto total. La
        ausencia de un libro significa información faltante, nunca gasto cero. No compare gestiones
        sin comprobar periodos y tipos disponibles.
      </p>
      {anios.map((anio) => (
        <section key={anio}>
          <h2 className="text-xl font-semibold">{anio}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Compras</th>
                  <th>Servicios</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => (
                  <tr key={mes}>
                    <td>{mes}</td>
                    {['ORDENES_COMPRA', 'ORDENES_SERVICIO'].map((tipo) => {
                      const libros = lotes.filter(
                        (b) =>
                          b.year === anio &&
                          b.month === mes &&
                          (b.importType === tipo || b.importType === 'CONSOLIDADO'),
                      );
                      const vigente = libros.find((b) => b.isCurrent);
                      return (
                        <td key={tipo}>
                          {vigente
                            ? vigente.coverageComplete &&
                              vigente.errorRows === 0 &&
                              vigente.excludedRows === 0
                              ? 'Completo declarado'
                              : 'Parcial / sin verificar'
                            : libros.some((b) => b.requiresReview)
                              ? 'Versiones pendientes de revisión'
                              : 'Sin libro vigente'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {lotes.length === 0 ? <p>No hay libros publicados.</p> : null}
      <h2 className="text-xl font-semibold">Libros y versiones</h2>
      {lotes.map((b) => (
        <section key={b.id} id={b.id} className="rounded border p-4 flex flex-col gap-2">
          <h3 className="font-semibold">
            {tituloLibro(b, config.municipio)}
          </h3>
          <p>
            {b.isCurrent
              ? 'Vigente'
              : b.requiresReview
                ? 'Revisión requerida: no se suma'
                : 'Histórica: no se suma'}{' '}
            · Actualización: {formatearFechaHora(b.processingFinishedAt)} · Filas importadas:{' '}
            {b.successfulRows}; errores: {b.errorRows}; excluidas: {b.excludedRows}; advertencias:{' '}
            {b.warningRows}
          </p>
          <p className="text-sm text-muted-foreground">Archivo cargado: {b.originalFilename}</p>
          <p>Hoja: {b.sheetName ?? 'Sin registro de hoja en esta versión antigua'}</p>
          <p className="break-all text-xs">SHA-256 del original: {b.checksum}</p>
          {b.sourceUrl ? (
            <a href={b.sourceUrl} rel="noopener noreferrer" target="_blank" className="underline">
              Consultar documento fuente
            </a>
          ) : (
            <p>Enlace original pendiente de documentar.</p>
          )}
          <Link className="underline font-medium" href={`/api/public/libros/${b.id}?formato=xlsx`}>
            Descargar extracto público Excel (.xlsx)
          </Link>
          {publicados.has(claveOriginal(b.id)) ? (
            <Link className="underline font-medium" href={`/api/public/libros/${b.id}/original`}>Descargar libro original</Link>
          ) : <p className="text-sm text-muted-foreground">Descarga del original no habilitada. Puedes consultar la fuente o descargar el extracto público.</p>}
          <Link className="underline" href={`/api/public/libros/${b.id}`}>
            Descargar extracto público CSV de esta versión
          </Link>
        </section>
      ))}
      <p>
        Los extractos Excel y CSV contienen los campos públicos normalizados y referencias de fila. No son copias del
        archivo original. La descarga del original, cuando está habilitada, conserva sus hojas y contenido. El hash identifica el original conservado por el portal. Las filas de
        versiones antiguas sin hoja registrada requieren revalidación.
      </p>
    </article>
  );
}
