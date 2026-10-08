import type { Metadata } from 'next';
import { ListadoPrensa } from '@/components/publico/listado-prensa';
import { contratacionesPrensa } from '@/services/pressService';
import { formatearMonto } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '¿Y la prensa cuánto cobra?', description: 'Consulta las órdenes municipales de las personas y medios del listado de seguimiento.' };

export default async function PaginaPrensa() {
  const resumen = await contratacionesPrensa();
  return <div className="flex flex-col gap-6">
    <header><h1 className="titulo-editorial text-3xl font-bold sm:text-4xl">¿Y la prensa cuánto cobra?</h1><p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">Consulta las contrataciones de las personas y medios del listado de seguimiento. Cada ficha reúne las órdenes del mismo RUC en todos los periodos publicados de esta municipalidad.</p></header>
    <div className="grid gap-3 sm:grid-cols-3">{[{ titulo: 'Personas y medios con órdenes', valor: `${resumen.conOrdenes} de ${resumen.filas.length}` }, { titulo: 'Órdenes vigentes registradas', valor: resumen.ordenes.toLocaleString('es-PE') }, { titulo: 'Monto considerado', valor: formatearMonto(resumen.considerado) }].map(dato => <div key={dato.titulo} className="rounded-xl border border-border bg-card p-5"><p className="text-xs text-muted-foreground">{dato.titulo}</p><p className="tabular mt-2 text-2xl font-semibold text-primary">{dato.valor}</p></div>)}</div>
    <p className="rounded-xl border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">Listado aportado para consulta; su inclusión no acredita empleo municipal. Los montos proceden de los libros vigentes importados y excluyen órdenes anuladas y estados no económicos. Una orden no acredita un pago efectivo; sin coincidencias significa que no hay registros en la cobertura disponible.</p>
    <ListadoPrensa filas={resumen.filas} />
  </div>;
}
