import { Suspense } from 'react';
import { EstadisticasExplorables } from '@/components/publico/estadisticas-explorables';
import { GraficoEvolucion } from '@/components/publico/grafico-evolucion';
import { GastoAlimentacion } from '@/components/publico/gasto-alimentacion';
import { categoriasGasto } from '@/lib/categorias-gasto';
import { estadisticasPorEtapa } from '@/services/statisticsExplorerService';
import { gastosPorCategoriaGestion } from '@/services/categorySpendingService';
import { gastoAlimentacionPorGestion } from '@/services/foodService';
import { evolucionMensual, evolucionAnual } from '@/services/statisticsService';
import type { Metadata } from 'next';

import { GraficoBarras, type BarraGrafico } from '@/components/publico/grafico-barras';
import { TablaComparativa } from '@/components/publico/tabla-comparativa';
import { Aviso } from '@/components/ui/data';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Seccion } from '@/components/ui/seccion';
import { formatearMonto } from '@/lib/utils';
import { comparativaPorGestion, concentracionGasto } from '@/services/statisticsService';

/** Exploración ciudadana: cobertura, conceptos, etapas de gobierno y evolución. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Estadísticas',
  description:
    'Explora gastos por gestión, tipo de RUC, primeros 100 días, último año de mandato, conceptos y evolución de las órdenes.',
};

export default async function PaginaEstadisticas() {
  const [gestiones, concentracion] = await Promise.all([
    comparativaPorGestion(),
    concentracionGasto(),
  ]);

  const sinDatos = gestiones.filter((fila) => fila.ordenes === 0);

  const cortes = concentracion.cortes.map((corte) => ({
    ...corte,
    etiqueta:
      corte.proveedores === 1 ? 'El mayor proveedor' : `Los ${corte.proveedores} mayores`,
  }));

  const barras: BarraGrafico[] = cortes.map((corte) => ({
    etiqueta: corte.etiqueta,
    valor: Number(corte.considerado),
    exacto: corte.considerado,
    detalle: `${corte.peso}% del monto considerado`,
  }));

  const top1 = cortes.find((corte) => corte.proveedores === 1);
  const top10 = cortes.find((corte) => corte.proveedores === 10);

  return (
    <div className="flex flex-col gap-10">
      <Breadcrumbs items={[{ label: 'Estadísticas' }]} />
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold sm:text-3xl">Estadísticas</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          ¿En qué se contrata, a quién y cuánto cambia entre gestiones? Explora los libros
          importados mediante comparaciones y gráficos. El <strong>monto considerado</strong>
          excluye órdenes anuladas y estados no económicos. Las órdenes no acreditan pagos.
        </p>
      </header>

      <nav aria-label="Explorar estadísticas" className="flex flex-wrap gap-2">{[['por-ruc', 'RUC 10 y RUC 20'], ['etapas', 'Inicio y cierre'], ['conceptos', '¿En qué se contrata?'], ['evolucion', 'Evolución'], ['concentraci-n-del-gasto', 'Concentración']].map(([id, titulo]) => <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">{titulo}</a>)}</nav>
      <Suspense fallback={<CargandoEstadisticas />}><PanelEtapas /></Suspense>
      <Suspense fallback={<CargandoEstadisticas />}><PanelConceptos /></Suspense>
      <Suspense fallback={<CargandoEstadisticas />}><PanelEvolucion /></Suspense>

      <Seccion
        titulo="Comparación por gestión"
        descripcion="Órdenes, proveedores y montos de cada periodo de gobierno."
      >
        <TablaComparativa filas={gestiones} />

        {sinDatos.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {sinDatos.length === 1 ? 'La gestión' : 'Las gestiones'}{' '}
            {sinDatos.map((fila) => fila.gestion).join(', ')}{' '}
            {sinDatos.length === 1 ? 'aparece' : 'aparecen'} en cero porque todavía no se ha
            importado ningún libro de {sinDatos.length === 1 ? 'ese periodo' : 'esos periodos'}. No
            es un error de cálculo: el periodo existe y aún no tiene datos.
          </p>
        ) : null}
      </Seccion>

      <Seccion
        titulo="Concentración del gasto"
        descripcion="Qué parte del monto considerado se reparte entre los mayores proveedores."
      >
        {concentracion.totalProveedores === 0 ? (
          <Aviso tono="info" titulo="Todavía no hay proveedores con órdenes">
            La concentración se calcula sobre las órdenes importadas. Aparecerá en cuanto se cargue
            el primer libro con proveedores.
          </Aviso>
        ) : (
          <>
            <GraficoBarras barras={barras} etiquetaSerie="Monto considerado acumulado" />

            <p className="text-sm text-muted-foreground">
              {top1 ? (
                <>
                  El mayor proveedor concentra el <strong>{top1.peso}%</strong> del monto
                  considerado
                </>
              ) : null}
              {top10 ? (
                <>
                  {' '}
                  y los diez mayores, el <strong>{top10.peso}%</strong>.
                </>
              ) : (
                '.'
              )}{' '}
              En total hay {concentracion.totalProveedores.toLocaleString('es-PE')} proveedores que
              suman{' '}
              <span className="tabular font-medium text-foreground">
                {formatearMonto(concentracion.totalConsiderado)}
              </span>
              . El detalle proveedor a proveedor está en el{' '}
              <a href="/ranking" className="underline underline-offset-2 hover:text-foreground">
                ranking
              </a>
              .
            </p>
          </>
        )}
      </Seccion>
    </div>
  );
}

function CargandoEstadisticas() {
  return <div role="status" className="rounded-xl border border-border bg-muted/30 p-6 text-sm text-muted-foreground">Preparando comparaciones con los libros disponibles…</div>;
}
async function PanelEtapas() { return <EstadisticasExplorables filas={await estadisticasPorEtapa()} />; }
async function PanelConceptos() {
  const [categorias, alimentacion] = await Promise.all([gastosPorCategoriaGestion(), gastoAlimentacionPorGestion()]);
  return <section id="conceptos" className="scroll-mt-6 space-y-4"><div><h2 className="text-xl font-semibold">¿En qué se contrata?</h2><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Todas las comparaciones de gastos, reunidas para explorar las tres gestiones. Las categorías se detectan por la descripción y pueden superponerse: no deben sumarse entre sí. Abre el desglose para revisar cada orden.</p></div>
    <div className="comparaciones-gastos grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3"><GastoAlimentacion filas={alimentacion} />{categoriasGasto.map(c => <GastoAlimentacion key={c.id} titulo={c.titulo} descripcion={c.descripcion} ruta={`/gastos/${c.id}`} filas={categorias.filter(f => f.categoria === c.id)} />)}</div>
  </section>;
}
async function PanelEvolucion() {
  const [mensual, anual] = await Promise.all([evolucionMensual(), evolucionAnual()]);
  const puntos = (filas: typeof mensual) => filas.map(f => ({ periodo: f.periodo, ordenes: f.ordenes, valor: Number(f.considerado), exacto: f.considerado }));
  return <section id="evolucion" className="scroll-mt-6 space-y-4"><h2 className="text-xl font-semibold">La evolución de las órdenes</h2><p className="text-sm text-muted-foreground">Todos los periodos importados. Los meses o años ausentes no se muestran como gasto cero.</p><div className="grid min-w-0 gap-6 xl:grid-cols-2"><div className="min-w-0"><h3 className="mb-3 font-semibold">Mes a mes</h3><GraficoEvolucion puntos={puntos(mensual)} etiquetaSerie="Monto considerado" nombrePeriodo="Mes" /></div><div className="min-w-0"><h3 className="mb-3 font-semibold">Año a año</h3><GraficoEvolucion puntos={puntos(anual)} etiquetaSerie="Monto considerado" nombrePeriodo="Año" /></div></div></section>;
}
