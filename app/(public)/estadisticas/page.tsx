import type { Metadata } from 'next';

import { GraficoBarras, type BarraGrafico } from '@/components/publico/grafico-barras';
import { TablaComparativa } from '@/components/publico/tabla-comparativa';
import { Aviso } from '@/components/ui/data';
import { Seccion } from '@/components/ui/seccion';
import { formatearMonto } from '@/lib/utils';
import { comparativaPorGestion, concentracionGasto } from '@/services/statisticsService';

/**
 * Estadísticas comparadas.
 *
 * Responde a la pregunta que el pliego pone en el recorrido del ciudadano
 * («¿cuánto recibió en cada gestión?»): compara las gestiones de gobierno entre sí
 * y mide cuánto del gasto se concentra en los mayores proveedores.
 *
 * Todas las cifras son sobre el monto considerado. Las órdenes anuladas se cuentan
 * —aparecen en la columna de anuladas— pero no suman.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Estadísticas',
  description:
    'Comparación del gasto entre gestiones de gobierno y concentración del monto considerado en los mayores proveedores.',
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
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold sm:text-3xl">Estadísticas</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Comparación del gasto entre gestiones de gobierno y de la concentración del monto en los
          mayores proveedores. Todas las cifras son sobre el{' '}
          <strong>monto considerado</strong>: las órdenes anuladas se cuentan, pero no suman.
        </p>
      </header>

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
