import { Building2, Coins, Receipt } from 'lucide-react';
import { formatearMonto } from '@/lib/utils';
import type { ResumenGeneral } from '@/services/statisticsService';

export function ResumenPortada({ resumen }: { resumen: ResumenGeneral }) {
  const tarjetas = [
    { titulo: 'Monto de órdenes registradas', valor: formatearMonto(resumen.totalRegistrado), icono: Coins, detalle: 'Órdenes de libros vigentes; no acredita pagos.' },
    { titulo: 'Órdenes consultables', valor: resumen.ordenes.toLocaleString('es-PE'), icono: Receipt, detalle: `${resumen.ordenesAnuladas.toLocaleString('es-PE')} anuladas, visibles pero excluidas del análisis.` },
    { titulo: 'Proveedores', valor: resumen.proveedores.toLocaleString('es-PE'), icono: Building2, detalle: 'Con órdenes en los libros vigentes disponibles.' },
  ];
  return <section aria-label="Resumen de todos los periodos disponibles" className="space-y-3">
    <div className="grid gap-4 lg:grid-cols-3">{tarjetas.map(({ titulo, valor, icono: Icono, detalle }) => <div key={titulo} className="panel-portada flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700"><Icono size={22} aria-hidden="true" /></span><div className="min-w-0"><p className="text-xs text-muted-foreground">{titulo}</p><p className="tabular titulo-editorial mt-1 break-words text-2xl font-bold sm:text-3xl">{valor}</p><p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{detalle}</p></div>
    </div>)}</div>
    <p className="text-xs leading-relaxed text-muted-foreground">Monto incluido en el análisis: <strong className="tabular text-primary">{formatearMonto(resumen.totalConsiderado)}</strong> · Monto anulado: <span className="tabular">{formatearMonto(resumen.totalAnulado)}</span>. El análisis excluye anuladas y estados que no cuentan económicamente. Las cifras no son el presupuesto municipal completo.</p>
  </section>;
}
