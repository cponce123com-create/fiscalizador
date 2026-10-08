import Link from 'next/link';
import { ArrowRight, Newspaper } from 'lucide-react';
import type { ResumenPrensa } from '@/lib/prensa';
import { formatearMonto } from '@/lib/utils';
import { TarjetaPrensa } from './tarjeta-prensa';

export function PortadaPrensa({ resumen }: { resumen: ResumenPrensa }) {
  return <section className="panel-portada" aria-labelledby="titulo-prensa">
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-3"><Newspaper size={24} className="shrink-0 text-primary" aria-hidden="true" /><h2 id="titulo-prensa" className="titulo-editorial text-2xl font-bold sm:text-3xl">¿Y la prensa cuánto cobra?</h2></div><p className="mt-2 text-sm text-muted-foreground">Personas y medios del listado de seguimiento · todos los periodos publicados.</p></div><Link href="/prensa" className="boton-enlace inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-primary">Ver el listado completo <ArrowRight size={16} aria-hidden="true" /></Link></div>
    <p className="mt-4 text-sm"><span className="font-semibold">{resumen.conOrdenes} de {resumen.filas.length}</span> con órdenes registradas · <span className="tabular font-semibold text-primary">{formatearMonto(resumen.considerado)}</span> de monto considerado.</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{resumen.filas.slice(0, 6).map(f => <TarjetaPrensa key={f.ruc} fila={f} />)}</div>
    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Los montos corresponden a órdenes, no acreditan pagos efectivos ni empleo municipal. Se excluyen anuladas y estados no económicos. Consulta cada ficha para ver las órdenes y sus documentos de origen.</p>
  </section>;
}
