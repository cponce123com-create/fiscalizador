import Link from 'next/link';
import { Prisma } from '@/lib/generated/prisma/client';
import { formatearMonto } from '@/lib/utils';
import type { EstadisticaEtapa, VentanaEstadistica } from '@/services/statisticsExplorerService';

const suma = (filas: EstadisticaEtapa[], campo: 'considerado' | 'anulado') => filas.reduce((n, f) => n.plus(f[campo]), new Prisma.Decimal(0)).toFixed(2);
function agrupar(filas: EstadisticaEtapa[], ventana: VentanaEstadistica, grupo?: string) {
  const seleccion = filas.filter(f => f.ventana === ventana && (!grupo || f.grupo === grupo));
  return [...new Set(seleccion.map(f => f.id))].map(id => {
    const partes = seleccion.filter(f => f.id === id);
    return { ...partes[0], considerado: suma(partes, 'considerado'), anulado: suma(partes, 'anulado'),
      ordenes: partes.reduce((n, f) => n + f.ordenes, 0), proveedores: partes.reduce((n, f) => n + f.proveedores, 0),
      anuladas: partes.reduce((n, f) => n + f.anuladas, 0), economicas: partes.reduce((n, f) => n + f.economicas, 0) };
  });
}
function Comparacion({ titulo, descripcion, filas, grupo }: { titulo: string; descripcion: string; filas: EstadisticaEtapa[]; grupo?: string }) {
  const maximo = Math.max(0, ...filas.map(f => Number(f.considerado)));
  return <article className="panel-portada flex min-w-0 flex-col gap-4">
    <div><h3 className="text-lg font-semibold">{titulo}</h3><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{descripcion}</p></div>
    <ul className="flex flex-col gap-5">{filas.map(f => {
      const params = new URLSearchParams({ gestion: f.id, ...(grupo && grupo !== 'otros' ? { tipoRuc: grupo } : {}), ...(f.ventana !== 'gestion' ? { desde: f.desde, hasta: f.hasta } : {}) });
      return <li key={f.id} className="min-w-0">
        <div className="flex flex-wrap justify-between gap-2 text-sm"><span className="font-medium">{f.gestion}</span><strong className="tabular text-primary">{!f.iniciada ? 'Aún no comienza' : !f.meses && !f.ordenes ? 'Sin libros disponibles' : formatearMonto(f.considerado)}</strong></div>
        <div className="my-2 h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full rounded-full bg-primary" style={{ width: `${maximo ? Math.max(0, Number(f.considerado)) / maximo * 100 : 0}%` }} /></div>
        <p className="text-xs text-muted-foreground">{f.ordenes} órdenes · {f.proveedores} proveedores · {f.anuladas} anuladas</p>
        <p className="mt-1 text-xs text-muted-foreground">{f.iniciada ? `${f.meses} meses con libros / ${f.esperados} meses transcurridos` : `Periodo previsto: ${f.desde} al ${f.hasta}`}</p>
        {f.ventana !== 'gestion' && f.iniciada ? <p className="mt-1 text-xs text-muted-foreground">Del {f.desde} al {f.hasta}</p> : null}
        {f.ordenes && grupo !== 'otros' ? <Link prefetch={false} href={`/ordenes?${params}`} className="mt-2 inline-flex min-h-11 items-center rounded-lg border border-border px-3 py-2 text-xs font-semibold text-primary">Explorar órdenes →</Link> : null}
      </li>;
    })}</ul>
    {!filas.length ? <p className="text-sm text-muted-foreground">Todavía no hay gestiones registradas.</p> : null}
  </article>;
}
export function EstadisticasExplorables({ filas }: { filas: EstadisticaEtapa[] }) {
  const totales = agrupar(filas, 'gestion');
  const total = suma(totales, 'considerado');
  const economicas = totales.reduce((n, f) => n + f.economicas, 0);
  const ruc10 = suma(filas.filter(f => f.ventana === 'gestion' && f.grupo === '10'), 'considerado');
  const ruc20 = suma(filas.filter(f => f.ventana === 'gestion' && f.grupo === '20'), 'considerado');
  const metricas = [
    ['Monto considerado', formatearMonto(total)],
    ['Órdenes registradas', totales.reduce((n, f) => n + f.ordenes, 0).toLocaleString('es-PE')],
    ['RUC 10 · personas naturales', formatearMonto(ruc10)],
    ['RUC 20 · personas jurídicas', formatearMonto(ruc20)],
    ['Monto anulado', formatearMonto(suma(totales, 'anulado'))],
    ['Promedio por orden económica', economicas ? formatearMonto(new Prisma.Decimal(total).div(economicas).toFixed(2)) : 'Sin órdenes económicas'],
  ];
  return <>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{metricas.map(([titulo, dato]) => <div key={titulo} className="panel-portada min-w-0"><p className="text-xs text-muted-foreground">{titulo}</p><p className="tabular mt-2 break-words text-xl font-bold text-primary sm:text-2xl">{dato}</p><p className="mt-2 text-[11px] text-muted-foreground">Últimas tres gestiones iniciadas · libros disponibles</p></div>)}</div>
    <section id="por-ruc" className="scroll-mt-6 space-y-4"><div><h2 className="text-xl font-semibold">¿A quién se contrata?</h2><p className="mt-2 text-sm text-muted-foreground">Comparación de montos por tipo de RUC. Los otros tipos se muestran aparte para que el total cuadre.</p></div>
      <div className="grid items-stretch gap-4 lg:grid-cols-3">{[['10', 'RUC 10 · personas naturales'], ['20', 'RUC 20 · personas jurídicas'], ['otros', 'Otros tipos de RUC']].map(([grupo, titulo]) => <Comparacion key={grupo} titulo={titulo} descripcion="Monto considerado por gestión, excluyendo anuladas y estados no económicos." grupo={grupo} filas={agrupar(filas, 'gestion', grupo)} />)}</div>
    </section>
    <section id="etapas" className="scroll-mt-6 space-y-4"><div><h2 className="text-xl font-semibold">El inicio y el cierre de cada gestión</h2><p className="mt-2 text-sm text-muted-foreground">Cortes por fecha de emisión. Compara la cobertura antes de interpretar diferencias; el último año de una gestión vigente puede estar incompleto o no haber empezado.</p></div>
      <div className="grid items-stretch gap-4 lg:grid-cols-2"><Comparacion titulo="Primeros 100 días" descripcion="Desde el primer día de mandato hasta el día 100 inclusive. Incluye todos los tipos de RUC." filas={agrupar(filas, 'primeros-100')} /><Comparacion titulo="Último año de mandato" descripcion="Año calendario en el que termina cada gestión, limitado a sus fechas oficiales. Incluye todos los tipos de RUC." filas={agrupar(filas, 'ultimo-anio')} /></div>
      <p className="text-xs leading-relaxed text-muted-foreground">Los meses con libros indican disponibilidad, no cobertura completa de todas las compras. El corte de 100 días puede utilizar solo una parte del último libro mensual. Las órdenes sin fecha de emisión no entran en estos cortes temporales.</p>
    </section>
  </>;
}
