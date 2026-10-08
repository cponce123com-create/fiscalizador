import Link from 'next/link';
import { Coins, Utensils } from 'lucide-react';
import type { GastoAlimentacionGestion } from '@/lib/alimentacion';
import { formatearMonto } from '@/lib/utils';

export function GastoAlimentacion({ filas, titulo = 'Gastos en alimentación', descripcion = 'Comparación de las tres gestiones · comidas, refrigerios, almuerzos, cenas, desayunos y similares.', ruta = '/alimentacion' }: { filas: GastoAlimentacionGestion[]; titulo?: string; descripcion?: string; ruta?: string }) {
  const tituloId = `titulo-${ruta.replace(/[^a-z0-9]/g, '-')}`;
  const Icono = ruta === '/alimentacion' ? Utensils : Coins;
  const maximo = Math.max(0, ...filas.map(f => Number(f.considerado)));
  return <section className="panel-portada" aria-labelledby={tituloId}>
    <h2 id={tituloId} className="titulo-editorial flex items-center gap-2 text-xl font-bold"><Icono size={20} className="shrink-0 text-primary" aria-hidden="true" />{titulo}</h2>
    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{descripcion}</p>
    <div className="mt-4 flex flex-col gap-4">{filas.map(f => <div key={f.id}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm"><span className="font-medium">{f.gestion}</span><span className="tabular font-semibold text-primary">{f.meses ? formatearMonto(f.considerado) : 'Sin libros publicados'}</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full rounded-full bg-primary" style={{ width: `${maximo ? Math.max(0, Number(f.considerado)) / maximo * 100 : 0}%` }} /></div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{f.meses} meses disponibles · {f.ordenes} órdenes{f.anuladas ? ` · ${f.anuladas} anuladas` : ''}</span>{f.ordenes ? <Link href={`${ruta}?gestion=${encodeURIComponent(f.id)}`} className="font-medium text-primary underline underline-offset-4">Ver órdenes</Link> : null}</div>
    </div>)}</div>
    {!filas.length ? <p className="mt-4 text-sm text-muted-foreground">Todavía no hay gestiones registradas.</p> : null}
    <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">Monto considerado de órdenes identificadas por su descripción; cada orden suma una sola vez. Excluye anuladas y estados no económicos. Cobertura parcial: los meses disponibles pueden variar entre gestiones.</p>
    <Link href={ruta} className="boton-enlace mt-3 inline-flex min-h-11 items-center rounded-lg border border-border px-3 py-2 text-xs font-semibold text-primary">Consultar desglose y metodología →</Link>
  </section>;
}
