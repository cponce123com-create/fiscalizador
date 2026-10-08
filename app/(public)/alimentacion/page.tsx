import type { Metadata } from 'next';
import { GastoAlimentacion } from '@/components/publico/gasto-alimentacion';
import { BusquedaEnVivo } from '@/components/publico/busqueda-en-vivo';
import { Paginacion } from '@/components/publico/paginacion';
import { TablaOrdenes } from '@/components/publico/tabla-ordenes';
import { leerFiltros, serializarFiltros } from '@/lib/filtros';
import { gastoAlimentacionPorGestion, listarOrdenesAlimentacion } from '@/services/foodService';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Gastos en alimentación por gestión' };
export default async function PaginaAlimentacion({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const filtros = leerFiltros({ gestion: raw.gestion, pagina: raw.pagina, porPagina: raw.porPagina });
  const [gestiones, resultado] = await Promise.all([gastoAlimentacionPorGestion(), listarOrdenesAlimentacion(filtros)]);
  filtros.pagina = resultado.pagina;
  return <div className="flex flex-col gap-6">
    <header><h1 className="text-2xl font-semibold sm:text-3xl">Alimentación: comparación por gestión</h1><p className="mt-3 text-sm text-muted-foreground">Órdenes de alimentación, alimentos, refrigerios, comidas, almuerzos, cenas, desayunos, bocaditos, lonches, catering, buffet, banquetes y raciones.</p></header>
    <GastoAlimentacion filas={gestiones} />
    <p className="rounded-xl border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">Clasificación automática por palabras completas en la descripción, sin distinguir tildes o mayúsculas. Se excluyen referencias a alimentación animal y fuentes de alimentación eléctrica. Se muestra el monto total de cada orden, incluso si combina varios conceptos; revisa el documento de origen para precisar su composición. Las órdenes no acreditan pagos efectivos y la falta de libros no representa gasto cero.</p>
    <BusquedaEnVivo ruta="/alimentacion" consulta={serializarFiltros(filtros)} className="rounded-xl border border-border bg-card p-4">
      <label className="flex flex-col gap-2 text-sm font-medium">Gestión<select name="gestion" defaultValue={filtros.gestionId ?? ''} className="min-h-11 rounded-lg border border-input bg-background px-3 py-2"><option value="">Todas las gestiones</option>{gestiones.map(g => <option key={g.id} value={g.id}>{g.gestion}</option>)}</select></label>
      <button className="mt-3 rounded-lg border border-primary bg-primary px-4 py-2 text-sm text-primary-foreground">Aplicar gestión</button>
    </BusquedaEnVivo>
    <Paginacion filtros={filtros} total={resultado.total} ruta="/alimentacion" />
    <TablaOrdenes ordenes={resultado.filas} />
    <Paginacion filtros={filtros} total={resultado.total} ruta="/alimentacion" />
  </div>;
}
