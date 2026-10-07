import { TextoCoincidente } from '@/components/publico/texto-coincidente';
import Link from 'next/link';

import { Insignia } from '@/components/ui/data';
import { formatearFecha, formatearMonto } from '@/lib/utils';

/**
 * Tabla de órdenes para el portal público.
 *
 * `mostrarProveedor` se desactiva en el perfil de un proveedor, donde repetir su
 * nombre en cada fila sería ruido.
 */
export function TablaOrdenes({
  ordenes,
  mostrarProveedor = true,
  consulta,
}: {
  ordenes: {
    id: string;
    orderNumber: string;
    issueDate: Date | null;
    description: string | null;
    amount: string | null;
    ruc: string;
    isCancelled: boolean;
    tipo: string | null;
    estado: string | null;
    proveedor: string;
    proveedorSlug: string;
  }[];
  mostrarProveedor?: boolean;
  consulta?: string;
}) {
  if (ordenes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        No hay órdenes que coincidan con los filtros aplicados.
      </p>
    );
  }

  return (
    <>
    <div className="grid gap-3 md:hidden">{ordenes.map(orden => <article key={orden.id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><Link href={`/ordenes/${orden.id}`} className="min-w-0 flex-1 break-words font-semibold text-primary">{orden.tipo} · Orden {orden.orderNumber}</Link><span className={`tabular shrink-0 whitespace-nowrap text-right font-semibold ${orden.isCancelled ? 'text-muted-foreground line-through' : ''}`}>{formatearMonto(orden.amount)}</span></div>
      <p className="mt-2 text-xs text-muted-foreground">{formatearFecha(orden.issueDate)}</p>
      {mostrarProveedor ? <Link href={`/proveedores/${orden.proveedorSlug}`} className="mt-3 block break-words text-sm font-medium">{orden.proveedor}<span className="block text-xs text-muted-foreground">RUC {orden.ruc}</span></Link> : null}
      <p className="my-3 break-words text-sm leading-relaxed"><TextoCoincidente texto={orden.description || 'Sin descripción en el libro'} consulta={consulta} /></p>
      <div className="flex flex-wrap items-center justify-between gap-3"><Insignia tono={orden.isCancelled ? 'error' : 'neutro'}>{orden.estado ?? 'Estado no informado'}{orden.isCancelled ? ' · no suma' : ''}</Insignia><Link href={`/ordenes/${orden.id}`} className="text-sm font-medium text-primary underline underline-offset-4">Ver detalle y fuente</Link></div>
    </article>)}</div>
    <div className="hidden md:block overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm"><caption className="sr-only">Órdenes registradas y sus montos</caption>
        <thead className="bg-muted/60">
          <tr>
            <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Emisión
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nº orden
            </th>
            {mostrarProveedor ? (
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Proveedor
              </th>
            ) : null}
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Descripción
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Estado
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Monto
            </th>
          </tr>
        </thead>

        <tbody>
          {ordenes.map((orden) => (
            <tr key={orden.id} className="border-t border-border align-top even:bg-muted/30 hover:bg-muted/60">
              <td className="tabular whitespace-nowrap px-3 py-2.5">
                {formatearFecha(orden.issueDate)}
              </td>

              <td className="px-3 py-2.5">
                <Link href={`/ordenes/${orden.id}`} className="font-medium underline underline-offset-2">{orden.orderNumber}</Link>
                {orden.tipo ? (
                  <span className="ml-2 text-xs text-muted-foreground">{orden.tipo}</span>
                ) : null}
              </td>

              {mostrarProveedor ? (
                <td className="max-w-[15rem] px-3 py-2.5">
                  <Link
                    href={`/proveedores/${orden.proveedorSlug}`}
                    className="line-clamp-2 hover:underline"
                    title={orden.proveedor}
                  >
                    {orden.proveedor}
                  </Link>
                  <span className="tabular block text-xs text-muted-foreground">{orden.ruc}</span>
                </td>
              ) : null}

              <td className="max-w-[22rem] px-3 py-2.5 text-muted-foreground">
                {orden.description ? (
                  <span className="line-clamp-2" title={orden.description}>
                    <TextoCoincidente texto={orden.description} consulta={consulta} />
                  </span>
                ) : (
                  <span className="text-xs italic opacity-70">Sin descripción en el libro</span>
                )}
              </td>

              <td className="whitespace-nowrap px-3 py-2.5">
                {orden.isCancelled ? (
                  <Insignia tono="error">{orden.estado ?? 'Anulada'} · no suma</Insignia>
                ) : (
                  <Insignia tono="neutro">{orden.estado ?? '—'}</Insignia>
                )}
              </td>

              <td
                className={
                  orden.isCancelled
                    ? 'tabular whitespace-nowrap px-3 py-2.5 text-right text-muted-foreground line-through'
                    : 'tabular whitespace-nowrap px-3 py-2.5 text-right font-medium'
                }
              >
                {formatearMonto(orden.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
