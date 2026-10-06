import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { GraficoBarras, type BarraGrafico } from '@/components/publico/grafico-barras';
import { GraficoEvolucion, type PuntoGrafico } from '@/components/publico/grafico-evolucion';
import { RankingProveedores } from '@/components/publico/ranking-proveedores';
import { TarjetasResumen } from '@/components/publico/tarjetas-resumen';
import { UltimosRegistros } from '@/components/publico/ultimos-registros';
import { Aviso } from '@/components/ui/data';
import { Seccion } from '@/components/ui/seccion';
import { prisma } from '@/lib/prisma';
import { datosPortada } from '@/services/statisticsService';

/**
 * Portada del portal público.
 *
 * Se renderiza en cada petición (`force-dynamic`) a propósito: las cifras deben
 * reflejar lo que hay en la base de datos ahora mismo. Si Next.js la prerenderizara,
 * los totales quedarían congelados en el momento del build y un administrador
 * importaría un libro sin que el portal cambiara. La caché es una optimización
 * para cuando el volumen de datos lo justifique, no antes.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Inicio',
  description:
    'Gasto en órdenes de compra y de servicio registradas en el Portal de Transparencia.',
};

export default async function PortadaPublica() {
  const [datos, pendientes] = await Promise.all([datosPortada(), prisma.importBatch.count({ where: { requiresReview: true } })]);
  const { resumen } = datos;

  // Los dos gráficos de evolución son idénticos cuando solo hay un periodo. En vez
  // de repetir el mismo aviso dos veces, se explica una sola vez.
  const evolucionDegenerada = datos.mensual.length < 2 && datos.anual.length < 2;

  const barrasContratacion: BarraGrafico[] = datos.contrataciones.map((fila) => ({
    etiqueta: fila.etiqueta,
    valor: Number(fila.considerado),
    exacto: fila.considerado,
    detalle: `${fila.ordenes} ${fila.ordenes === 1 ? 'orden' : 'órdenes'}`,
  }));

  const barrasGestion: BarraGrafico[] = datos.gestiones.map((fila) => ({
    etiqueta: `Gestión ${fila.gestion}`,
    valor: Number(fila.considerado),
    exacto: fila.considerado,
    detalle:
      fila.ordenes === 0
        ? 'sin datos cargados'
        : `${fila.ordenes} órdenes · ${fila.proveedores} proveedores`,
    atenuada: fila.ordenes === 0,
  }));

  const barrasTipoOrden: BarraGrafico[] = datos.tiposOrden.map((fila) => ({
    etiqueta: `${fila.codigo} · ${fila.etiqueta}`,
    valor: Number(fila.considerado),
    exacto: fila.considerado,
    detalle: `${fila.ordenes} ${fila.ordenes === 1 ? 'orden' : 'órdenes'}`,
  }));

  const puntosMensuales: PuntoGrafico[] = datos.mensual.map((punto) => ({
    periodo: punto.periodo,
    valor: Number(punto.considerado),
    exacto: punto.considerado,
    ordenes: punto.ordenes,
  }));

  const puntosAnuales: PuntoGrafico[] = datos.anual.map((punto) => ({
    periodo: punto.periodo,
    valor: Number(punto.considerado),
    exacto: punto.considerado,
    ordenes: punto.ordenes,
  }));

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold sm:text-3xl">
          Órdenes de compra y de servicio registradas por la municipalidad
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Consulta y análisis de los libros mensuales publicados en el Portal de Transparencia.
          Cada cifra de esta página procede de un registro del archivo original y puede
          rastrearse hasta él.
        </p>
      </div>

      <p className="rounded border p-4 text-sm">Las cifras corresponden a órdenes en libros vigentes disponibles; no son pagos realizados ni el presupuesto municipal completo. <Link href="/fuentes" className="underline">Consultar fuentes, actualización y cobertura</Link>. {pendientes > 0 ? `${pendientes} versiones antiguas requieren revisión y están excluidas de los totales; su ausencia no significa gasto cero.` : ''}</p>
      <TarjetasResumen resumen={resumen} />

      <Seccion
        titulo="Principales tipos de contratación"
        descripcion="Modalidad declarada en el libro, ordenada por monto considerado."
      >
        <GraficoBarras barras={barrasContratacion} etiquetaSerie="Monto considerado" />
        <p className="text-xs text-muted-foreground">
          Los importes del gráfico son los <strong>considerados</strong>: excluyen anuladas y estados fuera del análisis. No acreditan pagos.
        </p>
      </Seccion>

      <Seccion
        titulo="Proveedores con mayor monto"
        descripcion="Ordenados por monto considerado, con su peso sobre el total."
      >
        <RankingProveedores ranking={datos.ranking} totalProveedores={resumen.proveedores} />
      </Seccion>

      {evolucionDegenerada ? (
        <Seccion
          titulo="Evolución del monto de órdenes"
          descripcion="Comparación entre meses y entre años."
        >
          <Aviso tono="info" titulo="Todavía no hay evolución que mostrar">
            Con un único periodo cargado ({resumen.primerPeriodo}) no hay tendencia que comparar:
            un gráfico de un solo punto parece un error. Estas dos vistas se completarán solas al
            importar los siguientes libros mensuales.
          </Aviso>
        </Seccion>
      ) : (
        <Seccion titulo="Evolución del monto de órdenes" descripcion="Comparación entre meses y entre años.">
          <div className="grid gap-4 lg:grid-cols-2">
            <GraficoEvolucion
              puntos={puntosMensuales}
              etiquetaSerie="Monto considerado"
              nombrePeriodo="mes"
            />
            <GraficoEvolucion
              puntos={puntosAnuales}
              etiquetaSerie="Monto considerado"
              nombrePeriodo="año"
            />
          </div>
        </Seccion>
      )}

      <div className="grid gap-10 lg:grid-cols-2">
        <Seccion
          titulo="Gasto por gestión"
          descripcion="Periodos de gobierno definidos en el sistema."
        >
          <GraficoBarras barras={barrasGestion} etiquetaSerie="Monto considerado" />
        </Seccion>

        <Seccion
          titulo="Órdenes de compra y de servicio"
          descripcion="Reparto por tipo de orden, sobre el monto considerado."
        >
          <GraficoBarras barras={barrasTipoOrden} etiquetaSerie="Monto considerado" />
        </Seccion>
      </div>

      <Seccion
        titulo="Últimos registros"
        descripcion="Las órdenes más recientes incorporadas al portal."
        accion={
          <Link
            href="/metodologia"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Cómo se obtienen los datos
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        }
      >
        <UltimosRegistros registros={datos.ultimos} />
      </Seccion>
    </div>
  );
}
