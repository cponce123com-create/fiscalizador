import { TipoRucRanking } from '@/components/publico/tipo-ruc-ranking';
import { leerFiltros, filtrosPorDefecto, serializarFiltros } from '@/lib/filtros';
import { Suspense } from 'react';
import { categoriasGasto } from '@/lib/categorias-gasto';
import { gastosPorCategoriaGestion } from '@/services/categorySpendingService';
import { GastoAlimentacion } from '@/components/publico/gasto-alimentacion';
import { GuiaUso } from '@/components/publico/guia-uso';
import { gastoAlimentacionPorGestion } from '@/services/foodService';
import { PortadaPrensa } from '@/components/publico/portada-prensa';
import { contratacionesPrensa } from '@/services/pressService';
import { BusquedaPortada } from '@/components/publico/busqueda-portada';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BookOpen, CalendarDays, Database, FileSearch, MapPin, ShieldCheck, TriangleAlert } from 'lucide-react';
import { EvolucionPortada } from '@/components/publico/evolucion-portada';
import { RankingProveedores } from '@/components/publico/ranking-proveedores';
import { ResumenPortada } from '@/components/publico/resumen-portada';
import { UltimosRegistros } from '@/components/publico/ultimos-registros';
import { Seccion } from '@/components/ui/seccion';
import { Skeleton } from '@/components/ui/data';
import { prisma } from '@/lib/prisma';
import { formatearFechaHora } from '@/lib/utils';
import { PeriodoRanking } from '@/components/publico/periodo-ranking';
import { seleccionarPeriodoRanking } from '@/lib/periodo-ranking';
import { datosPortadaInicial, periodosDelRanking } from '@/services/statisticsService';
import { leerConfiguracionPortal } from '@/services/portalService';
import { idMunicipalidadDesdeSlug, municipalidadActivaDesdeSlug } from '@/services/municipalityService';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Inicio',
  description: 'Vigilancia ciudadana: consulta órdenes, proveedores y documentos de origen de la municipalidad.',
};
const enlaceSeccion = 'inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline underline-offset-4';

export default async function PortadaPublica({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parametros = await searchParams;
  const filtrosBase = leerFiltros(parametros);
  const municipalityId = await idMunicipalidadDesdeSlug(filtrosBase.municipalidadSlug);
  const periodosRanking = await periodosDelRanking(filtrosBase);
  const gestionRanking = seleccionarPeriodoRanking(parametros.gestion, periodosRanking);
  const tipoRucRanking = filtrosBase.tipoRuc;
  const filtrosRanking = { ...filtrosPorDefecto(), municipalidadSlug: filtrosBase.municipalidadSlug, gestionId: gestionRanking, tipoRuc: tipoRucRanking };
  const conMunicipalidad = (href: string) => filtrosBase.municipalidadSlug ? `${href}${href.includes('?') ? '&' : '?'}municipalidad=${filtrosBase.municipalidadSlug}` : href;
  const etiquetaRuc = tipoRucRanking ? `RUC ${tipoRucRanking}` : 'Todos los tipos de RUC';
  const nombreRanking = periodosRanking.find(p => p.id === gestionRanking)?.nombre ?? 'Todos los periodos';
  const [datos, pendientes, ultimaActualizacion, config, municipalidad] = await Promise.all([
    datosPortadaInicial(gestionRanking, tipoRucRanking, municipalityId),
    prisma.importBatch.count({ where: { municipalityId, requiresReview: true, status: { in: ['COMPLETED', 'COMPLETED_WITH_WARNINGS'] } } }),
    prisma.importBatch.findFirst({ where: { municipalityId, isCurrent: true, status: { in: ['COMPLETED', 'COMPLETED_WITH_WARNINGS'] } }, orderBy: { processingFinishedAt: 'desc' }, select: { processingFinishedAt: true } }),
    leerConfiguracionPortal(),
    municipalidadActivaDesdeSlug(filtrosBase.municipalidadSlug),
  ]);
  const { resumen } = datos;
  const periodo = resumen.primerPeriodo ? resumen.primerPeriodo === resumen.ultimoPeriodo ? resumen.primerPeriodo : `${resumen.primerPeriodo} a ${resumen.ultimoPeriodo}` : 'Sin libros publicados';
  return <div className="flex flex-col gap-5 sm:gap-7">
    <section className="grid items-center gap-7 lg:grid-cols-[1.15fr_1fr]" aria-labelledby="titulo-portada">
      <div>
        <p className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.16em] text-primary"><ShieldCheck size={15} aria-hidden="true" />Observatorio ciudadano · {municipalidad.nombreCorto}</p>
        <h1 id="titulo-portada" className="titulo-editorial max-w-xl text-4xl font-bold leading-[1.06] tracking-tight sm:text-5xl lg:text-[3.25rem]">Conoce qué compra tu municipalidad</h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">Explora órdenes, proveedores y documentos de origen de la {municipalidad.nombre.replace(/^Municipalidad /, 'municipalidad ')}.</p>
        <BusquedaPortada municipalidad={filtrosBase.municipalidadSlug} />
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"><span>Búsquedas frecuentes:</span>{['Combustible', 'Obras', 'Limpieza'].map(texto => <Link key={texto} href={conMunicipalidad(`/ordenes?texto=${texto.toLowerCase()}`)} className="boton-enlace rounded-full border border-border bg-muted px-3 py-1.5 hover:border-primary hover:text-primary">{texto}</Link>)}</div>
      </div>
      <div className="relative flex min-h-64 flex-col justify-between overflow-hidden rounded-2xl bg-emerald-950 p-6 text-white sm:min-h-80">
        {config.fotoPortada ? <Image src={config.fotoPortada} alt={config.creditoFoto} fill sizes="(max-width: 1024px) 100vw, 500px" className="object-cover" /> : <><div aria-hidden="true" className="absolute -right-20 -top-20 h-80 w-80 rounded-full border-[35px] border-emerald-800/35" /><div aria-hidden="true" className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full border-[35px] border-amber-300/10" /><Image src={config.logo || "/identidad/escudo-san-ramon.webp"} alt={config.logo ? `Logo del portal de ${municipalidad.nombreCorto}` : `Escudo de ${municipalidad.nombreCorto}`} width={132} height={136} className="relative mx-auto my-4 h-36 w-full max-w-64 object-contain" /></>}
        <div className={`relative mt-auto rounded-xl p-4 ${config.fotoPortada ? 'bg-emerald-950/85' : 'border border-white/15 bg-white/5'}`}><p className="flex items-center gap-2 text-sm font-semibold"><MapPin size={16} className="shrink-0 text-amber-300" aria-hidden="true" />{municipalidad.nombreCorto}, {municipalidad.provincia}</p><p className="mt-1 text-xs text-emerald-100">{config.fotoPortada ? config.creditoFoto : 'Municipalidad consultada · Portal ciudadano independiente'}</p></div>
      </div>
    </section>

    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4 text-xs">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2"><p className="flex items-center gap-2"><CalendarDays size={15} className="text-primary" aria-hidden="true" /><strong>Libros disponibles:</strong> {periodo}</p><p className="flex items-center gap-2"><Database size={15} className="text-primary" aria-hidden="true" />{resumen.mesesCargados} meses con libros vigentes</p></div>
      <div><p className="text-[10px] text-muted-foreground">Última incorporación: {ultimaActualizacion?.processingFinishedAt ? formatearFechaHora(ultimaActualizacion.processingFinishedAt) : 'Sin datos publicados'}</p><Link href={conMunicipalidad('/fuentes')} className={enlaceSeccion}>Ver fuentes y cobertura <ArrowRight size={13} aria-hidden="true" /></Link></div>
    </div>
    <GuiaUso />
    {pendientes > 0 ? <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs leading-relaxed text-amber-950">{pendientes} versiones antiguas requieren revisión y están excluidas de los totales. La ausencia de información no significa gasto cero. <Link href={conMunicipalidad('/fuentes')} className="font-semibold underline">Consultar los periodos pendientes</Link>.</p> : null}
    <ResumenPortada resumen={resumen} />

    <div className="grid items-stretch gap-4 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-5"><div className="panel-portada"><Seccion titulo="Evolución de órdenes" descripcion="Monto considerado, según fecha de emisión." accion={<Link href={`/estadisticas${serializarFiltros(filtrosRanking, { gestionId: null, tipoRuc: null })}`} className={enlaceSeccion}>Ver análisis <ArrowRight size={13} aria-hidden="true" /></Link>}><EvolucionPortada puntos={datos.mensual} /></Seccion></div><Suspense fallback={<CargaSeccion titulo="Gastos en alimentación" />}><AlimentacionPortada municipalityId={municipalityId} /></Suspense><Suspense fallback={<CargaSeccion titulo="Gastos en combustible" />}><CombustiblePortada municipalityId={municipalityId} /></Suspense></div>
      <div className="panel-portada min-w-0 self-start"><Seccion titulo="Ranking de proveedores" descripcion={`Por monto considerado · ${nombreRanking} · ${etiquetaRuc}.`} accion={<Link href={`/ranking${serializarFiltros(filtrosRanking)}`} className={enlaceSeccion}>Ver ranking completo <ArrowRight size={13} aria-hidden="true" /></Link>}><PeriodoRanking periodos={periodosRanking} seleccionado={gestionRanking} /><TipoRucRanking filtros={filtrosRanking} ruta="/" /><RankingProveedores ranking={datos.ranking} /></Seccion></div>
    </div>

    <Suspense fallback={<CargaSeccion titulo="Comparaciones de gastos por gestión" />}><ComparacionesGastos municipalityId={municipalityId} /></Suspense>
    <Suspense fallback={<CargaSeccion titulo="Contrataciones del listado de prensa" />}><SeguimientoPrensa /></Suspense>

    <section aria-labelledby="titulo-revision" className="rounded-2xl border border-amber-300 bg-amber-50/70 p-5 sm:p-6">
      <div className="flex items-start gap-3"><TriangleAlert className="mt-1 shrink-0 text-amber-700" size={22} aria-hidden="true" /><div><h2 id="titulo-revision" className="titulo-editorial text-2xl font-bold">Órdenes para revisar</h2><p className="mt-1 text-xs text-amber-950/80">Comienza por consultar el detalle y contrastar el documento de origen.</p></div></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><Link href={conMunicipalidad('/ordenes?orden=monto&direccion=desc')} className="rounded-xl border border-amber-200 bg-white p-5 transition-colors hover:border-amber-500"><FileSearch size={21} className="mb-3 text-primary" aria-hidden="true" /><h3 className="text-sm font-semibold">Explora las órdenes de mayor monto</h3><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Consulta qué se contrató, quién es el proveedor y cuál es la fuente. Un monto alto no demuestra una irregularidad.</p><span className={`${enlaceSeccion} mt-3`}>Consultar órdenes <ArrowRight size={13} aria-hidden="true" /></span></Link><div className="rounded-xl border border-amber-200 bg-white p-5"><ShieldCheck size={21} className="mb-3 text-amber-700" aria-hidden="true" /><h3 className="text-sm font-semibold">Sobrevaloración: sin evaluación disponible</h3><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Los libros actuales registran montos de órdenes. No hay precios unitarios ni referencias de mercado suficientes para publicar alertas de sobrevaloración.</p><Link href={conMunicipalidad('/metodologia')} className={`${enlaceSeccion} mt-3`}>Conoce la metodología <ArrowRight size={13} aria-hidden="true" /></Link></div></div>
    </section>

    <div className="panel-portada"><Seccion titulo="Últimas órdenes registradas" descripcion="Órdenes con fecha de emisión más reciente en los libros vigentes." accion={<Link href={conMunicipalidad('/ordenes')} className={enlaceSeccion}>Ver todas las órdenes <ArrowRight size={13} aria-hidden="true" /></Link>}><UltimosRegistros registros={datos.ultimos} /></Seccion></div>

    <section className="panel-portada" aria-labelledby="titulo-fuentes"><div className="mb-5 flex items-center gap-3"><BookOpen size={24} className="text-primary" aria-hidden="true" /><div><h2 id="titulo-fuentes" className="titulo-editorial text-2xl font-bold">Comprueba cada cifra</h2><p className="mt-1 text-xs text-muted-foreground">Información pública con procedencia y límites visibles.</p></div></div><div className="grid gap-3 sm:grid-cols-3">{[{ titulo: 'Libros originales', texto: 'Consulta los archivos, versiones y referencias que respaldan las órdenes.', href: '/fuentes', icono: BookOpen }, { titulo: 'Cobertura mensual', texto: 'Distingue libros completos, parciales y periodos sin información.', href: '/fuentes', icono: CalendarDays }, { titulo: 'Metodología', texto: 'Conoce qué sumamos, qué excluimos y cómo verificar la evidencia.', href: '/metodologia', icono: ShieldCheck }].map(({ titulo, texto, href, icono: Icono }) => <Link key={titulo} href={conMunicipalidad(href)} className="flex items-start gap-3 rounded-xl border border-border p-4 hover:border-primary"><span className="rounded-lg bg-muted p-2 text-primary"><Icono size={20} aria-hidden="true" /></span><span><span className="block text-sm font-semibold">{titulo}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{texto}</span></span></Link>)}</div></section>

    <Link href={conMunicipalidad('/estadisticas')} className="boton-enlace flex min-h-11 items-center justify-between gap-3 rounded-xl px-5 py-4 text-sm font-semibold text-primary">Más análisis: modalidades, gestiones y tipos de orden <ArrowRight size={18} aria-hidden="true" /></Link>
  </div>;
}

function CargaSeccion({ titulo }: { titulo: string }) {
  return <div role="status" aria-live="polite" className="panel-portada min-h-40"><p className="font-semibold">{titulo}</p><p className="mt-2 text-sm text-muted-foreground">Cargando datos de los libros…</p><div className="mt-5 space-y-3"><Skeleton className="h-3 w-2/3" /><Skeleton className="h-8 w-full" /><Skeleton className="h-3 w-5/6" /></div></div>;
}
async function AlimentacionPortada({ municipalityId }: { municipalityId: string }) {
  return <GastoAlimentacion filas={await gastoAlimentacionPorGestion(municipalityId)} />;
}
async function CombustiblePortada({ municipalityId }: { municipalityId: string }) {
  const categoria = categoriasGasto.find(c => c.id === 'combustible')!;
  const gastos = await gastosPorCategoriaGestion(municipalityId);
  return <GastoAlimentacion titulo={categoria.titulo} descripcion={categoria.descripcion} ruta="/gastos/combustible" filas={gastos.filter(f => f.categoria === categoria.id)} />;
}
async function ComparacionesGastos({ municipalityId }: { municipalityId: string }) {
  const gastos = await gastosPorCategoriaGestion(municipalityId);
  return <section aria-labelledby="titulo-gastos-categorias" className="flex flex-col gap-4">
    <header><h2 id="titulo-gastos-categorias" className="titulo-editorial text-2xl font-bold">¿En qué se gasta? Compara las gestiones</h2><p className="mt-2 text-sm text-muted-foreground">Las últimas tres gestiones iniciadas, según los libros disponibles. Una orden puede pertenecer a más de una categoría: estos montos no se suman entre sí.</p></header>
    <div className="comparaciones-gastos grid items-stretch gap-4 md:grid-cols-2">{categoriasGasto.filter(c => c.id !== 'combustible').map(c => <GastoAlimentacion key={c.id} titulo={c.titulo} descripcion={c.descripcion} ruta={`/gastos/${c.id}`} filas={gastos.filter(f => f.categoria === c.id)} />)}</div>
  </section>;
}
async function SeguimientoPrensa() { return <PortadaPrensa resumen={await contratacionesPrensa()} />; }
