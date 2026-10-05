import { Insignia } from '@/components/ui/data';
import { formatearFecha, formatearMonto } from '@/lib/utils';
import type { FilaUltimoRegistro } from '@/services/statisticsService';

/**
 * Últimos registros importados.
 *
 * La orden anulada se marca de forma explícita y con la palabra «no suma», no
 * solo con color. En un portal de transparencia, que una cifra aparezca en una
 * tabla y no en un total es justo lo que hay que explicar.
 */
export function UltimosRegistros({ registros }: { registros: FilaUltimoRegistro[] }) {
  if (registros.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
        Todavía no hay órdenes importadas.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Emisión
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nº orden
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Proveedor
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Estado
            </th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Monto
            </th>
          </tr>
        </thead>

        <tbody>
          {registros.map((registro) => (
            <tr key={registro.id} className="border-t border-border">
              <td className="tabular whitespace-nowrap px-3 py-2.5">
                {formatearFecha(registro.issueDate)}
              </td>

              <td className="px-3 py-2.5">
                <span className="font-medium">{registro.orderNumber}</span>
                {registro.tipo ? (
                  <span className="ml-2 text-xs text-muted-foreground">{registro.tipo}</span>
                ) : null}
              </td>

              <td className="max-w-[16rem] truncate px-3 py-2.5" title={registro.proveedor}>
                {registro.proveedor}
                <span className="tabular block text-xs text-muted-foreground">{registro.ruc}</span>
              </td>

              <td className="px-3 py-2.5">
                {registro.isCancelled ? (
                  <Insignia tono="error">{registro.estado ?? 'Anulada'} · no suma</Insignia>
                ) : (
                  <Insignia tono="exito">{registro.estado ?? '—'}</Insignia>
                )}
              </td>

              <td
                className={
                  registro.isCancelled
                    ? 'tabular whitespace-nowrap px-3 py-2.5 text-right text-muted-foreground line-through'
                    : 'tabular whitespace-nowrap px-3 py-2.5 text-right font-medium'
                }
              >
                {formatearMonto(registro.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
