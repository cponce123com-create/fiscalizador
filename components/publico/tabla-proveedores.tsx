import Link from 'next/link';

import { formatearFecha, formatearMonto } from '@/lib/utils';
import type { FilaProveedorListado } from '@/services/statisticsService';

/**
 * Listado alfabético de proveedores.
 *
 * Cada fila enlaza al perfil, que es donde está el detalle. La primera y la última
 * aparición se muestran como fechas y no como años: el pliego pide el año, pero la
 * fecha completa es más informativa y no cuesta nada, porque el servicio ya la
 * calcula con `MIN`/`MAX` sobre `issueDate`.
 */
export function TablaProveedores({ proveedores }: { proveedores: FilaProveedorListado[] }) {
  if (proveedores.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        No hay proveedores que coincidan con los filtros aplicados.
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
              Tipo
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Órdenes
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Monto considerado
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Primera aparición
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Última aparición
            </th>
          </tr>
        </thead>

        <tbody>
          {proveedores.map((proveedor) => (
            <tr key={proveedor.id} className="border-t border-border align-top">
              <td className="max-w-[22rem] px-3 py-2.5">
                <Link
                  href={`/proveedores/${proveedor.slug}`}
                  className="line-clamp-2 font-medium hover:underline"
                  title={proveedor.nombre}
                >
                  {proveedor.nombre}
                </Link>
                <span className="tabular block text-xs text-muted-foreground">{proveedor.ruc}</span>
              </td>

              <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                {proveedor.tipo}
              </td>

              <td className="tabular whitespace-nowrap px-3 py-2.5 text-right">
                {proveedor.ordenes.toLocaleString('es-PE')}
              </td>

              <td className="tabular whitespace-nowrap px-3 py-2.5 text-right font-medium">
                {formatearMonto(proveedor.considerado)}
              </td>

              <td className="tabular whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                {proveedor.primeraAparicion ? formatearFecha(proveedor.primeraAparicion) : '—'}
              </td>

              <td className="tabular whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                {proveedor.ultimaAparicion ? formatearFecha(proveedor.ultimaAparicion) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
