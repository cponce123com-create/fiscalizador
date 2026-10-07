import Link from 'next/link';
import { formatearMonto } from '@/lib/utils';
import type { PuntoEvolucion } from '@/services/statisticsService';
import { GraficoEvolucion } from './grafico-evolucion';

const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

/** Vista por fecha de emisión; la cobertura de archivos se presenta por separado. */
export function EvolucionPortada({ puntos }: { puntos: PuntoEvolucion[] }) {
  const anio = puntos.at(-1)?.periodo.slice(0, 4);
  if (!anio) return <p className="rounded-xl bg-muted p-6 text-sm text-muted-foreground">Todavía no hay órdenes con fecha de emisión. Consulta los libros disponibles en Fuentes.</p>;
  const serie = puntos.filter(p => p.periodo.startsWith(`${anio}-`));
  if (serie.some(p => Number(p.considerado) < 0)) return <GraficoEvolucion puntos={serie.map(p => ({ periodo: p.periodo, valor: Number(p.considerado), exacto: p.considerado, ordenes: p.ordenes }))} etiquetaSerie="Monto considerado" nombrePeriodo="mes" />;
  const mayor = serie.reduce<PuntoEvolucion | undefined>((actual, p) => !actual || Number(p.considerado) > Number(actual.considerado) ? p : actual, undefined);
  const maximo = Math.max(...serie.map(p => Number(p.considerado)), 1);
  return <div>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>Año {anio} · por fecha de emisión</span><span>Mayor monto: {formatearMonto(mayor?.considerado ?? '0.00')}</span></div>
    <div className="grid h-52 grid-cols-12 items-end gap-1 border-b border-border bg-[linear-gradient(to_top,var(--border)_1px,transparent_1px)] bg-[length:100%_25%] sm:gap-2" aria-label={`Monto considerado por mes de ${anio}`}>
      {meses.map((mes, i) => {
        const punto = serie.find(p => p.periodo === `${anio}-${String(i + 1).padStart(2, '0')}`);
        const monto = punto ? Number(punto.considerado) : 0;
        const texto = punto ? `${mes}: ${formatearMonto(punto.considerado)}, ${punto.ordenes} órdenes` : `${mes}: sin órdenes fechadas disponibles`;
        return <Link key={mes} href={`/ordenes?anio=${anio}&mes=${i + 1}`} className="group flex h-full items-end rounded-t focus-visible:outline-offset-4" aria-label={texto} title={texto}>
          {punto ? <span className="w-full rounded-t bg-emerald-700 transition-colors group-hover:bg-emerald-500" style={{ height: `${monto > 0 ? Math.max(monto / maximo * 100, 1) : 0}%` }} /> : <span className="mb-1 h-2 w-full rounded-sm border border-dashed border-gray-400 bg-gray-100" />}
        </Link>;
      })}
    </div>
    <div aria-hidden="true" className="mt-2 grid grid-cols-12 gap-1 text-center text-[9px] text-muted-foreground sm:gap-2 sm:text-xs">{meses.map(m => <span key={m}>{m}</span>)}</div>
    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Selecciona un mes para ver sus órdenes. Las marcas grises indican ausencia de órdenes fechadas disponibles, no gasto cero.{serie.length < 2 ? ' Con un solo mes no se puede establecer una tendencia.' : ''}</p>
    <details className="mt-3 text-xs"><summary className="cursor-pointer font-medium text-primary">Ver cifras exactas</summary><ul className="mt-2 space-y-1 text-muted-foreground">{serie.map(p => <li key={p.periodo}>{p.periodo}: {formatearMonto(p.considerado)} · {p.ordenes} órdenes</li>)}</ul></details>
  </div>;
}
