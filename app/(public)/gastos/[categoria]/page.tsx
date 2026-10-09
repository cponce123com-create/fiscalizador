import { imagenCompartida, metadataCompartida } from '@/lib/compartir';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { categoriaGastoPorId } from '@/lib/categorias-gasto';
import { GastoAlimentacion } from '@/components/publico/gasto-alimentacion';
import { BusquedaEnVivo } from '@/components/publico/busqueda-en-vivo';
import { Paginacion } from '@/components/publico/paginacion';
import { TablaOrdenes } from '@/components/publico/tabla-ordenes';
import { leerFiltros, serializarFiltros } from '@/lib/filtros';
import { gastosPorCategoriaGestion, listarOrdenesCategoria } from '@/services/categorySpendingService';
import { idMunicipalidadDesdeSlug } from '@/services/municipalityService';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ categoria: string }> }): Promise<Metadata> {
  const categoria = categoriaGastoPorId((await params).categoria);
  return categoria ? metadataCompartida(`${categoria.titulo} por gestión`, `${categoria.descripcion} Compara los montos registrados en órdenes por gestión y explora sus documentos de origen.`, `/gastos/${categoria.id}`, imagenCompartida('gasto', categoria.id)) : { title: 'Categoría no encontrada' };
}
export default async function PaginaGastos({ params, searchParams }: { params: Promise<{ categoria: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const categoria = categoriaGastoPorId((await params).categoria);
  if (!categoria) notFound();
  const ruta = `/gastos/${categoria.id}`;
  const raw = await searchParams;
  const filtros = leerFiltros({ municipalidad: raw.municipalidad, gestion: raw.gestion, pagina: raw.pagina, porPagina: raw.porPagina });
  const municipalityId = await idMunicipalidadDesdeSlug(filtros.municipalidadSlug);
  const [comparacion, resultado] = await Promise.all([gastosPorCategoriaGestion(municipalityId), listarOrdenesCategoria(categoria, filtros)]);
  const gestiones = comparacion.filter(g => g.categoria === categoria.id);
  filtros.pagina = resultado.pagina;
  return <div className="flex flex-col gap-6">
    <header><h1 className="text-2xl font-semibold sm:text-3xl">{categoria.titulo}: comparación por gestión</h1><p className="mt-3 text-sm text-muted-foreground">{categoria.descripcion}</p></header>
    <GastoAlimentacion filas={gestiones} titulo={categoria.titulo} descripcion={categoria.descripcion} ruta={ruta} />
    <p className="rounded-xl border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">Clasificación automática por palabras completas en la descripción, sin distinguir tildes o mayúsculas. Se muestra el monto total de cada orden, incluso si combina varios conceptos; revisa el documento de origen para precisar su composición. Una orden puede coincidir con varias categorías; los totales entre categorías no son aditivos. Las órdenes no acreditan pagos efectivos y la falta de libros no representa gasto cero.</p>
    <BusquedaEnVivo ruta={ruta} consulta={serializarFiltros(filtros)} className="rounded-xl border border-border bg-card p-4">
      <label className="flex flex-col gap-2 text-sm font-medium">Gestión<select name="gestion" defaultValue={filtros.gestionId ?? ''} className="min-h-11 rounded-lg border border-input bg-background px-3 py-2"><option value="">Todas las gestiones</option>{gestiones.map(g => <option key={g.id} value={g.id}>{g.gestion}</option>)}</select></label>
      <button className="mt-3 rounded-lg border border-primary bg-primary px-4 py-2 text-sm text-primary-foreground">Aplicar gestión</button>
    </BusquedaEnVivo>
    <Paginacion filtros={filtros} total={resultado.total} ruta={ruta} />
    <TablaOrdenes ordenes={resultado.filas} />
    <Paginacion filtros={filtros} total={resultado.total} ruta={ruta} />
  </div>;
}
