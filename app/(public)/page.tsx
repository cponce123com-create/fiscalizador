import { BusquedaPortada } from '@/components/publico/busqueda-portada';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BookOpen, CalendarDays, Database, FileSearch, MapPin, ShieldCheck, TriangleAlert } from 'lucide-react';
import { EvolucionPortada } from '@/components/publico/evolucion-portada';
import { GraficoBarras } from '@/components/publico/grafico-barras';
import { RankingProveedores } from '@/components/publico/ranking-proveedores';
import { ResumenPortada } from '@/components/publico/resumen-portada';
import { UltimosRegistros } from '@/components/publico/ultimos-registros';
import { Seccion } from '@/components/ui/seccion';
import { prisma } from '@/lib/prisma';
import { formatearFechaHora } from '@/lib/utils';
import { datosPortada } from '@/services/statisticsService';
import { leerConfiguracionPortal } from '@/services/portalService';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Inicio',
  description: 'Vigilancia ciudadana de San Ramón: consulta órdenes, proveedores y documentos de origen de la municipalidad.',
};
const enlaceSeccion = 'inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline underline-offset-4';

export default async function PortadaPublica() {
  const [datos, pendientes, ultimaActualizacion, config] = await Promise.all([
    datosPortada(),
    prisma.importBatch.count({ where: { requiresReview: true, status: { in: ['COMPLETED', 'COMPLETED_WITH_WARNINGS'] } } }),
    prisma.importBatch.findFirst({ where: { isCurrent: true, status: { in: ['COMPLETED', 'COMPLETED_WITH_WARNINGS'] } }, orderBy: { processingFinishedAt: 'desc' }, select: { processingFinishedAt: true } }),
    leerConfiguracionPortal(),
  ]);
  const { resumen } = datos;
  const periodo = resumen.primerPeriodo ? resumen.primerPeriodo === resumen.ultimoPeriodo ? resumen.primerPeriodo : `${resumen.primerPeriodo} a ${resumen.ultimoPeriodo}` : 'Sin libros publicados';
  return <div className="flex flex-col gap-7 sm:gap-9">
    <section className="grid items-center gap-7 lg:grid-cols-[1.15fr_1fr]" aria-labelledby="titulo-portada">
      <div>
        <p className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.16em] text-primary"><ShieldCheck size={15} aria-hidden="true" />Observatorio ciudadano · San Ramón</p>
        <h1 id="titulo-portada" className="titulo-editorial max-w-xl text-4xl font-bold leading-[1.06] tracking-tight sm:text-5xl lg:text-[3.25rem]">Conoce qué compra tu municipalidad</h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">Explora órdenes, proveedores y documentos de origen de la {config.municipio.replace(/^Municipalidad /, 'municipalidad ')}.</p>
        <BusquedaPortada />
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"><span>Búsquedas frecuentes:</span>{['Combustible', 'Obras', 'Limpieza'].map(texto => <Link key={texto} href={`/ordenes?texto=${texto.toLowerCase()}`} className="boton-enlace rounded-full border border-border bg-muted px-3 py-1.5 hover:border-primary hover:text-primary">{texto}</Link>)}</div>
      </div>
      <div className="relative flex min-h-64 flex-col justify-between overflow-hidden rounded-2xl bg-emerald-950 p-6 text-white sm:min-h-80">
        {config.fotoPortada ? <Image src={config.fotoPortada} alt={config.creditoFoto} fill sizes="(max-width: 1024px) 100vw, 500px" className="object-cover" /> : <><div aria-hidden="true" className="absolute -right-20 -top-20 h-80 w-80 rounded-full border-[35px] border-emerald-800/35" /><div aria-hidden="true" className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full border-[35px] border-amber-300/10" /><Image src={config.logo || "/identidad/escudo-san-ramon.webp"} alt={config.logo ? "Logo del portal" : "Escudo de San Ramón"} width={132} height={136} className="relative mx-auto my-4 h-36 w-full max-w-64 object-contain" /></>}
        <div className={`relative mt-auto rounded-xl p-4 ${config.fotoPortada ? 'bg-emerald-950/85' : 'border border-white/15 bg-white/5'}`}><p className="flex items-center gap-2 text-sm font-semibold"><MapPin size={16} className="shrink-0 text-amber-300" aria-hidden="true" />San Ramón, Chanchamayo</p><p className="mt-1 text-xs text-emerald-100">{config.fotoPortada ? config.creditoFoto : 'Municipalidad consultada · Portal ciudadano independiente'}</p></div>
      </div>
    </section>

    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4 text-xs">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2"><p className="flex items-center gap-2"><CalendarDays size={15} className="text-primary" aria-hidden="true" /><strong>Libros disponibles:</strong> {periodo}</p><p className="flex items-center gap-2"><Database size={15} className="text-primary" aria-hidden="true" />{resumen.mesesCargados} meses con libros vigentes</p></div>
      <div><p className="text-[10px] text-muted-foreground">Última incorporación: {ultimaActualizacion?.processingFinishedAt ? formatearFechaHora(ultimaActualizacion.processingFinishedAt) : 'Sin datos publicados'}</p><Link href="/fuentes" className={enlaceSeccion}>Ver fuentes y cobertura <ArrowRight size={13} aria-hidden="true" /></Link></div>
    </div>
    {pendientes > 0 ? <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs leading-relaxed text-amber-950">{pendientes} versiones antiguas requieren revisión y están excluidas de los totales. La ausencia de información no significa gasto cero. <Link href="/fuentes" className="font-semibold underline">Consultar los periodos pendientes</Link>.</p> : null}
    <ResumenPortada resumen={resumen} />

    <div className="grid items-start gap-5 lg:grid-cols-2">
      <div className="panel-portada"><Seccion titulo="Evolución de órdenes" descripcion="Monto considerado, según fecha de emisión." accion={<Link href="/estadisticas" className={enlaceSeccion}>Ver análisis <ArrowRight size={13} aria-hidden="true" /></Link>}><EvolucionPortada puntos={datos.mensual} /></Seccion></div>
      <div className="panel-portada"><Seccion titulo="Ranking de proveedores" descripcion="Por monto considerado · todos los periodos disponibles." accion={<Link href="/ranking" className={enlaceSeccion}>Ver ranking completo <ArrowRight size={13} aria-hidden="true" /></Link>}><RankingProveedores ranking={datos.ranking.slice(0, 5)} totalProveedores={resumen.proveedores} /></Seccion></div>
    </div>

    <section aria-labelledby="titulo-revision" className="rounded-2xl border border-amber-300 bg-amber-50/70 p-5 sm:p-6">
      <div className="flex items-start gap-3"><TriangleAlert className="mt-1 shrink-0 text-amber-700" size={22} aria-hidden="true" /><div><h2 id="titulo-revision" className="titulo-editorial text-2xl font-bold">Órdenes para revisar</h2><p className="mt-1 text-xs text-amber-950/80">Comienza por consultar el detalle y contrastar el documento de origen.</p></div></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><Link href="/ordenes?orden=monto&direccion=desc" className="rounded-xl border border-amber-200 bg-white p-5 transition-colors hover:border-amber-500"><FileSearch size={21} className="mb-3 text-primary" aria-hidden="true" /><h3 className="text-sm font-semibold">Explora las órdenes de mayor monto</h3><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Consulta qué se contrató, quién es el proveedor y cuál es la fuente. Un monto alto no demuestra una irregularidad.</p><span className={`${enlaceSeccion} mt-3`}>Consultar órdenes <ArrowRight size={13} aria-hidden="true" /></span></Link><div className="rounded-xl border border-amber-200 bg-white p-5"><ShieldCheck size={21} className="mb-3 text-amber-700" aria-hidden="true" /><h3 className="text-sm font-semibold">Sobrevaloración: sin evaluación disponible</h3><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Los libros actuales registran montos de órdenes. No hay precios unitarios ni referencias de mercado suficientes para publicar alertas de sobrevaloración.</p><Link href="/metodologia" className={`${enlaceSeccion} mt-3`}>Conoce la metodología <ArrowRight size={13} aria-hidden="true" /></Link></div></div>
    </section>

    <div className="panel-portada"><Seccion titulo="Últimas órdenes registradas" descripcion="Órdenes con fecha de emisión más reciente en los libros vigentes." accion={<Link href="/ordenes" className={enlaceSeccion}>Ver todas las órdenes <ArrowRight size={13} aria-hidden="true" /></Link>}><UltimosRegistros registros={datos.ultimos} /></Seccion></div>

    <section className="panel-portada" aria-labelledby="titulo-fuentes"><div className="mb-5 flex items-center gap-3"><BookOpen size={24} className="text-primary" aria-hidden="true" /><div><h2 id="titulo-fuentes" className="titulo-editorial text-2xl font-bold">Comprueba cada cifra</h2><p className="mt-1 text-xs text-muted-foreground">Información pública con procedencia y límites visibles.</p></div></div><div className="grid gap-3 sm:grid-cols-3">{[{ titulo: 'Libros originales', texto: 'Consulta los archivos, versiones y referencias que respaldan las órdenes.', href: '/fuentes', icono: BookOpen }, { titulo: 'Cobertura mensual', texto: 'Distingue libros completos, parciales y periodos sin información.', href: '/fuentes', icono: CalendarDays }, { titulo: 'Metodología', texto: 'Conoce qué sumamos, qué excluimos y cómo verificar la evidencia.', href: '/metodologia', icono: ShieldCheck }].map(({ titulo, texto, href, icono: Icono }) => <Link key={titulo} href={href} className="flex items-start gap-3 rounded-xl border border-border p-4 hover:border-primary"><span className="rounded-lg bg-muted p-2 text-primary"><Icono size={20} aria-hidden="true" /></span><span><span className="block text-sm font-semibold">{titulo}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{texto}</span></span></Link>)}</div></section>

    <details className="rounded-xl border border-border bg-card p-5"><summary className="cursor-pointer text-sm font-semibold">Más análisis: modalidades, gestiones y tipos de orden</summary><div className="mt-6 grid gap-8 lg:grid-cols-2"><Seccion titulo="Tipos de contratación"><GraficoBarras barras={datos.contrataciones.map(f => ({ etiqueta: f.etiqueta, valor: Number(f.considerado), exacto: f.considerado, detalle: `${f.ordenes} órdenes` }))} etiquetaSerie="Monto considerado" /></Seccion><Seccion titulo="Montos por gestión"><GraficoBarras barras={datos.gestiones.map(f => ({ etiqueta: f.gestion, valor: Number(f.considerado), exacto: f.considerado, detalle: `${f.ordenes} órdenes`, atenuada: f.ordenes === 0 }))} etiquetaSerie="Monto considerado" /></Seccion><Seccion titulo="Compras y servicios"><GraficoBarras barras={datos.tiposOrden.map(f => ({ etiqueta: f.etiqueta, valor: Number(f.considerado), exacto: f.considerado, detalle: `${f.ordenes} órdenes` }))} etiquetaSerie="Monto considerado" /></Seccion><p className="text-xs leading-relaxed text-muted-foreground">Estas cifras no acreditan pagos. Consulta la cobertura de meses y tipos de libro antes de comparar gestiones: la falta de información nunca representa gasto cero.</p></div></details>
  </div>;
}
