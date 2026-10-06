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
}) {
  if (ordenes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        No hay órdenes que coincidan con los filtros aplicados.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
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
            <tr key={orden.id} className="border-t border-border align-top">
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
                    {orden.description}
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
  );
}
