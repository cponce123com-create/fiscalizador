import Link from 'next/link';

import { formatearMonto } from '@/lib/utils';
import type { FilaRanking } from '@/services/statisticsService';
import { FotoProveedor } from './foto-proveedor';

/**
 * Ranking de proveedores por monto considerado.
 *
 * Se muestra el PESO de cada proveedor sobre el total, no solo la cifra. En los
 * datos actuales eso revela lo que de verdad importa: un proveedor concentra el
 * 36% del gasto y los dos primeros, más de la mitad. Una tabla de montos sin
 * porcentajes deja ese hallazgo invisible.
 *
 * La barra representa la participación real sobre el total, no un valor
 * reescalado: si el primero ocupa el 36%, la barra mide el 36%.
 */
export function RankingProveedores({
  ranking,
  totalProveedores,
}: {
  ranking: FilaRanking[];
  totalProveedores?: number;
}) {
  if (ranking.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
        Todavía no hay proveedores con órdenes importadas.
      </p>
    );
  }

  const sumaPeso = ranking.reduce((acumulado, fila) => acumulado + fila.peso, 0);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {ranking.map((fila, indice) => (
          <li key={fila.supplierId} className="flex flex-col gap-3 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 basis-full items-center sm:flex-1 sm:basis-auto gap-3">
                <span className={`tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${indice === 0 ? 'bg-amber-100 text-amber-900' : 'bg-muted text-muted-foreground'}`}>
                  {indice + 1}
                </span>
                <FotoProveedor key={fila.fotoUrl} url={fila.fotoUrl} nombre={fila.nombre} />
                <div className="min-w-0">
                  <Link
                    href={`/proveedores/${fila.slug}`}
                    className="block text-sm font-semibold leading-snug text-foreground hover:underline break-words"
                    title={fila.nombre}
                  >
                    {fila.nombre}
                  </Link>
                  <p className="tabular break-words text-xs text-muted-foreground">
                    RUC {fila.ruc} · {fila.ordenes}{' '}
                    {fila.ordenes === 1 ? 'orden' : 'órdenes'}
                    {fila.anuladas > 0 ? ` · ${fila.anuladas} ${fila.anuladas === 1 ? 'anulada' : 'anuladas'}` : ''}
                  </p>
                </div>
              </div>

              <div className="ml-auto shrink-0 text-right">
                <p className="tabular text-sm font-semibold text-foreground">
                  {formatearMonto(fila.considerado)}
                </p>
                <p className="tabular break-words text-xs text-muted-foreground">{fila.peso}% del total</p>
              </div>
            </div>

            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="presentation"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full bg-primary/70"
                style={{ width: `${Math.min(100, Math.max(fila.peso, 0))}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">
        {totalProveedores === undefined ? `${ranking.length} proveedores destacados` : `${ranking.length} de ${totalProveedores} proveedores`}. Entre ellos concentran el{' '}
        <span className="tabular font-medium text-foreground">{Math.round(sumaPeso * 10) / 10}%</span>{' '}
        del monto considerado.
      </p>
    </div>
  );
}
