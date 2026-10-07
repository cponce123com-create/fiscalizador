import { notFound } from 'next/navigation';
import Link from 'next/link';
import { leerConfiguracionPortal } from '@/services/portalService';
import { prisma } from '@/lib/prisma';
import { camposOcultos } from '@/lib/public-evidence';
import { formatearFecha, formatearFechaHora, formatearMonto } from '@/lib/utils';
export const dynamic = 'force-dynamic';
export default async function DetalleOrden({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const config = await leerConfiguracionPortal();
  const orden = await prisma.order.findUnique({
    where: { id },
    include: {
      importBatch: true,
      supplier: true,
      status: true,
      orderType: true,
    },
  });
  if (!orden || !['COMPLETED', 'COMPLETED_WITH_WARNINGS'].includes(orden.importBatch.status))
    notFound();
  const b = orden.importBatch;
  const ocultos = await camposOcultos(b.id);
  const campos: [string, string, unknown][] = [
    ['orderNumber', 'Número', orden.orderNumber],
    ['orderType', 'Tipo', orden.orderType?.label],
    ['supplierName', 'Proveedor', orden.supplier.name],
    ['ruc', 'RUC', orden.ruc],
    ['issueDate', 'Emisión', formatearFecha(orden.issueDate)],
    ['description', 'Descripción', orden.description],
    ['amount', 'Monto de la orden', formatearMonto(orden.amount?.toString())],
    ['status', 'Estado normalizado', orden.status?.label],
    ['status', 'Estado original', orden.rawStatus],
    ['siafNumber', 'Expediente SIAF', orden.siafNumber],
  ];
  return (
    <article className="mx-auto max-w-3xl flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:p-8">
      <h1 className="text-2xl font-semibold">Detalle y evidencia de la orden</h1>
      <p>
        {b.isCurrent
          ? 'Versión vigente incluida en el universo actual'
          : 'Versión histórica o pendiente: excluida de los totales actuales'}
      </p>
      <dl>
        {campos
          .filter(([campo]) => !ocultos.has(campo))
          .map(([campo, label, valor]) => (
            <div key={`${campo}-${label}`} className="grid gap-1 border-b border-border py-3 sm:grid-cols-[12rem_1fr]">
              <dt className="font-semibold">{label}</dt>
              <dd>{String(valor ?? 'No informado')}</dd>
            </div>
          ))}
      </dl>
      <p>
        {!orden.isCancelled && orden.status?.countsEconomically
          ? 'Incluida en el monto considerado'
          : 'Excluida del monto considerado'}
        . El registro no acredita un pago realizado.
      </p>
      <h2 className="mt-4 border-t border-border pt-5 text-lg font-semibold">Documento de origen</h2>
      <p>
        Entidad: {config.municipio}.
        Versión {b.version}. Incorporación: {formatearFechaHora(b.processingFinishedAt)}.
      </p>
      <p>
        Libro: {b.originalFilename}; periodo {b.year}-{b.month}; hoja:{' '}
        {b.sheetName ?? 'pendiente de revalidar'}; fila:{' '}
        {b.sheetName ? orden.sourceRow : 'referencia antigua pendiente de revalidar'}.
      </p>
      <p className="break-all text-xs">SHA-256 del original: {b.checksum}</p>
      <Link id="fuente-orden" className="scroll-mt-6 rounded-lg bg-primary px-4 py-3 text-center text-sm font-medium text-primary-foreground" href={`/fuentes#${b.id}`}>
        Ver fuente, cobertura y descargar extracto
      </Link>
      <p>
        Este enlace conserva la referencia a esta versión de la orden aunque el libro se sustituya.
      </p>
    </article>
  );
}
