import Link from 'next/link';

import { Insignia } from '@/components/ui/data';
import { formatearMonto } from '@/lib/utils';
import type { FilaMultiGestion } from '@/services/statisticsService';

/**
 * Proveedores que aparecen en más de una gestión.
 *
 * El detalle se muestra como lista y no como una matriz con una columna por
 * gestión: las gestiones se definen en la base de datos y pueden crecer, así que
 * una matriz obligaría a fijar el número de columnas en el código. Con la lista,
 * añadir una gestión nueva no requiere tocar esta pantalla.
 */
export function TablaHistorial({ filas }: { filas: FilaMultiGestion[] }) {
  if (filas.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        Ningún proveedor aparece en el número de gestiones solicitado.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Proveedor
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Gestiones
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Detalle por gestión
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Total considerado
            </th>
          </tr>
        </thead>

        <tbody>
          {filas.map((fila) => (
            <tr key={fila.supplierId} className="border-t border-border align-top">
              <td className="max-w-[22rem] px-3 py-2.5">
                <Link
                  href={`/proveedores/${fila.slug}`}
                  className="line-clamp-2 font-medium hover:underline"
                  title={fila.nombre}
                >
                  {fila.nombre}
                </Link>
                <span className="tabular block text-xs text-muted-foreground">{fila.ruc}</span>
              </td>

              <td className="whitespace-nowrap px-3 py-2.5">
                <Insignia tono={fila.gestiones > 1 ? 'info' : 'neutro'}>
                  {fila.gestiones} {fila.gestiones === 1 ? 'gestión' : 'gestiones'}
                </Insignia>
              </td>

              <td className="px-3 py-2.5">
                <ul className="flex flex-col gap-1">
                  {fila.detalle.map((d) => (
                    <li key={d.gestion} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                      <span className="font-medium text-foreground">{d.gestion}</span>
                      <span className="text-muted-foreground">
                        {d.ordenes} {d.ordenes === 1 ? 'orden' : 'órdenes'} ·
                      </span>
                      <span className="tabular text-foreground">{formatearMonto(d.considerado)}</span>
                    </li>
                  ))}
                </ul>
              </td>

              <td className="tabular whitespace-nowrap px-3 py-2.5 text-right font-semibold">
                {formatearMonto(fila.totalConsiderado)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
