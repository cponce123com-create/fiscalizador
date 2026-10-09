import Link from 'next/link';

import { EstadoVacio } from '@/components/ui/data';
import { formatearMonto } from '@/lib/utils';
import type { FilaRankingCompleto } from '@/services/statisticsService';
import { FotoProveedor } from './foto-proveedor';

/**
 * Tabla del ranking de proveedores.
 *
 * Se muestra solo el monto considerado. Las anuladas se cuentan para trazabilidad,
 * pero su importe agregado no se publica.
 */
export function TablaRanking({ filas }: { filas: FilaRankingCompleto[] }) {
  if (filas.length === 0) {
    return (
      <EstadoVacio
        titulo="Sin proveedores en este ranking"
        descripcion="Cambia la gestión, el tipo de RUC o limpia la búsqueda para volver a comparar."
      >
        <Link href="/ranking" className="boton-enlace rounded-lg px-4 py-2 text-sm text-primary">Restablecer ranking</Link>
      </EstadoVacio>
    );
  }

  return (
    <><div className="grid gap-3 md:hidden">{filas.map(f => <article key={f.supplierId} className="min-w-0 rounded-xl border border-border bg-card p-4"><div className="flex gap-3"><FotoProveedor key={f.fotoUrl} url={f.fotoUrl} nombre={f.nombre} /><div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">Puesto {f.posicion} · {f.peso}% del monto considerado</p><Link href={`/proveedores/${f.slug}`} className="mt-2 block break-words font-semibold text-primary">{f.nombre}</Link><p className="mt-1 text-xs text-muted-foreground">RUC {f.ruc} · {f.ordenes} órdenes{f.anuladas ? ` · ${f.anuladas} anuladas` : ''}</p></div></div><dl className="mt-4 grid gap-2 text-sm"><div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">Considerado</dt><dd className="tabular font-semibold">{formatearMonto(f.considerado)}</dd></div></dl><Link href={`/proveedores/${f.slug}`} className="mt-3 inline-flex min-h-11 items-center text-sm text-primary underline">Consultar proveedor</Link></article>)}</div>
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

              <td className="max-w-[26rem] px-3 py-2.5">
                <div className="flex items-start gap-3">
                  <FotoProveedor key={fila.fotoUrl} url={fila.fotoUrl} nombre={fila.nombre} />
                  <div className="min-w-0">
                    <Link
                      href={`/proveedores/${fila.slug}`}
                      className="line-clamp-2 font-medium hover:underline"
                      title={fila.nombre}
                    >
                      {fila.nombre}
                    </Link>
                    <span className="tabular block text-xs text-muted-foreground">{fila.ruc}</span>
                  </div>
                </div>
              </td>

              <td className="tabular whitespace-nowrap px-3 py-2.5 text-right">
                {fila.ordenes.toLocaleString('es-PE')}
                {fila.anuladas > 0 ? (
                  <span className="block text-xs text-muted-foreground">
                    {fila.anuladas} anulada{fila.anuladas === 1 ? '' : 's'}
                  </span>
                ) : null}
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
