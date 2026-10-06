import Link from 'next/link';
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
  const anios = [...new Set(lotes.map((b) => b.year))];
  return (
    <article className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Fuentes y cobertura</h1>
      <p>
        Portal ciudadano independiente: órdenes registradas, no pagos ni
        presupuesto total. La ausencia de un libro significa información
        faltante, nunca gasto cero. No compare gestiones sin comprobar periodos
        y tipos disponibles.
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
                          (b.importType === tipo ||
                            b.importType === 'CONSOLIDADO'),
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
        <section
          key={b.id}
          id={b.id}
          className="rounded border p-4 flex flex-col gap-2"
        >
          <h3 className="font-semibold">
            {b.year}-{String(b.month).padStart(2, '0')} · {b.importType} ·{' '}
            {b.originalFilename}
          </h3>
          <p>
            {b.isCurrent
              ? 'Vigente'
              : b.requiresReview
                ? 'Revisión requerida: no se suma'
                : 'Histórica: no se suma'}{' '}
            · Actualización: {formatearFechaHora(b.processingFinishedAt)} ·
            Filas importadas: {b.successfulRows}; errores: {b.errorRows};
            excluidas: {b.excludedRows}; advertencias: {b.warningRows}
          </p>
          <p>
            Hoja:{' '}
            {b.sheetName ?? 'Sin registro de hoja en esta versión antigua'}
          </p>
          <p className="break-all text-xs">
            SHA-256 del original: {b.checksum}
          </p>
          {b.sourceUrl ? (
            <a
              href={b.sourceUrl}
              rel="noopener noreferrer"
              target="_blank"
              className="underline"
            >
              Consultar documento fuente
            </a>
          ) : (
            <p>Enlace original pendiente de documentar.</p>
          )}
          <Link className="underline" href={`/api/public/libros/${b.id}`}>
            Descargar extracto público CSV de esta versión
          </Link>
        </section>
      ))}
      <p>
        El CSV contiene los campos públicos normalizados y referencias de fila.
        No es una copia del archivo original. El hash identifica el original
        conservado por el portal. Las filas de versiones antiguas sin hoja
        registrada requieren revalidación.
      </p>
    </article>
  );
}
