import { formatearMonto } from '@/lib/utils';
import type { FilaComparativa } from '@/services/statisticsService';

/**
 * Comparación del gasto entre gestiones.
 *
 * Se publica solo el monto considerado. Las anuladas se cuentan para trazabilidad,
 * pero su importe agregado no se muestra al público.
 */
export function TablaComparativa({ filas }: { filas: FilaComparativa[] }) {
  if (filas.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        No hay gestiones definidas en el sistema.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <p className="p-3 text-sm text-muted-foreground">
        Comparación de órdenes disponibles, no de pagos ni de presupuestos completos. Revise Fuentes
        y cobertura antes de comparar gestiones. El promedio incluye únicamente órdenes con monto
        conocido y estado incluido en el análisis.
      </p>
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr>
            <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Gestión
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Órdenes
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Anuladas
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Proveedores
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Considerado
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Peso
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ticket medio
            </th>
          </tr>
        </thead>

        <tbody>
          {filas.map((fila) => (
            <tr
              key={fila.gestion}
              className={
                fila.ordenes === 0
                  ? 'border-t border-border align-top text-muted-foreground'
                  : 'border-t border-border align-top'
              }
            >
              <td className="whitespace-nowrap px-3 py-2.5">
                <span className="font-medium">Gestión {fila.gestion}</span>
                {fila.ordenes === 0 ? (
                  <span className="block text-xs">sin libros importados</span>
                ) : null}
              </td>

              <td className="tabular whitespace-nowrap px-3 py-2.5 text-right">
                {fila.ordenes.toLocaleString('es-PE')}
              </td>

              <td className="tabular whitespace-nowrap px-3 py-2.5 text-right">
                {fila.anuladas.toLocaleString('es-PE')}
              </td>

              <td className="tabular whitespace-nowrap px-3 py-2.5 text-right">
                {fila.proveedores.toLocaleString('es-PE')}
              </td>

              <td className="tabular whitespace-nowrap px-3 py-2.5 text-right font-semibold">
                {formatearMonto(fila.considerado)}
              </td>

              <td className="tabular whitespace-nowrap px-3 py-2.5 text-right">{fila.peso}%</td>

              <td className="tabular whitespace-nowrap px-3 py-2.5 text-right">
                {fila.ordenes > 0 ? formatearMonto(fila.ticketMedio) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
