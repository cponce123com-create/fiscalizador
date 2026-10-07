import Link from 'next/link';

import { formatearMonto } from '@/lib/utils';
import type { FilaRankingCompleto } from '@/services/statisticsService';

/**
 * Tabla del ranking de proveedores.
 *
 * Los tres montos van separados —registrado, anulado y considerado— porque es la
 * única forma de que el ciudadano entienda por qué la cifra que suma no coincide
 * con la que aparece en el libro. La posición es la del conjunto filtrado, así que
 * al filtrar por RUC 20 la numeración vuelve a empezar en 1.
 */
export function TablaRanking({ filas }: { filas: FilaRankingCompleto[] }) {
  if (filas.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        No hay proveedores que coincidan con los filtros aplicados.
      </p>
    );
  }

  return (
    <><div className="grid gap-3 md:hidden">{filas.map(f => <article key={f.supplierId} className="min-w-0 rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Puesto {f.posicion} · {f.peso}% del monto considerado</p><Link href={`/proveedores/${f.slug}`} className="mt-2 block break-words font-semibold text-primary">{f.nombre}</Link><p className="mt-1 text-xs text-muted-foreground">RUC {f.ruc} · {f.ordenes} órdenes{f.anuladas ? ` · ${f.anuladas} anuladas` : ''}</p><dl className="mt-4 grid gap-2 text-sm">{[['Considerado', f.considerado], ['Registrado', f.registrado], ['Anulado', f.anulado]].map(([etiqueta, monto]) => <div key={etiqueta} className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">{etiqueta}</dt><dd className="tabular font-semibold">{formatearMonto(monto)}</dd></div>)}</dl><Link href={`/proveedores/${f.slug}`} className="mt-3 inline-flex min-h-11 items-center text-sm text-primary underline">Consultar proveedor</Link></article>)}</div>
    <div className="hidden md:block overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr>
            <th className="w-12 px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              #
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Proveedor
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Órdenes
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Registrado
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Anulado
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Considerado
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Peso
            </th>
          </tr>
        </thead>

        <tbody>
          {filas.map((fila) => (
            <tr key={fila.supplierId} className="border-t border-border align-top">
              <td className="tabular px-3 py-2.5 text-right font-medium text-muted-foreground">
                {fila.posicion}
              </td>

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

              <td className="tabular whitespace-nowrap px-3 py-2.5 text-right">
                {fila.ordenes.toLocaleString('es-PE')}
                {fila.anuladas > 0 ? (
                  <span className="block text-xs text-muted-foreground">
                    {fila.anuladas} anulada{fila.anuladas === 1 ? '' : 's'}
                  </span>
                ) : null}
              </td>

              <td className="tabular whitespace-nowrap px-3 py-2.5 text-right text-muted-foreground">
                {formatearMonto(fila.registrado)}
              </td>

              <td
                className={
                  fila.anulado === '0.00'
                    ? 'tabular whitespace-nowrap px-3 py-2.5 text-right text-muted-foreground'
                    : 'tabular whitespace-nowrap px-3 py-2.5 text-right text-destructive'
                }
              >
                {formatearMonto(fila.anulado)}
              </td>

              <td className="tabular whitespace-nowrap px-3 py-2.5 text-right font-semibold">
                {formatearMonto(fila.considerado)}
              </td>

              <td className="tabular whitespace-nowrap px-3 py-2.5 text-right text-muted-foreground">
                {fila.peso}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div></>
  );
}
