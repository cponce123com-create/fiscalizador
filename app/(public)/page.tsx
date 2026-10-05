import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { GraficoBarras, type BarraGrafico } from '@/components/publico/grafico-barras';
import { GraficoEvolucion, type PuntoGrafico } from '@/components/publico/grafico-evolucion';
import { RankingProveedores } from '@/components/publico/ranking-proveedores';
import { TarjetasResumen } from '@/components/publico/tarjetas-resumen';
import { UltimosRegistros } from '@/components/publico/ultimos-registros';
import { Aviso } from '@/components/ui/data';
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
  const datos = await datosPortada();
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
    valor: Number(fila.registrado),
    exacto: fila.registrado,
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
          En qué se gastó el presupuesto en órdenes de compra y de servicio
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Consulta y análisis de los libros mensuales publicados en el Portal de Transparencia.
          Cada cifra de esta página procede de un registro del archivo original y puede
          rastrearse hasta él.
        </p>
      </div>

      <TarjetasResumen resumen={resumen} />

      <Seccion
        titulo="Principales tipos de contratación"
        descripcion="Modalidad declarada en el libro, ordenada por monto registrado."
      >
        <GraficoBarras barras={barrasContratacion} etiquetaSerie="Monto considerado" />
        <p className="text-xs text-muted-foreground">
          Los importes que aparecen aquí son los <strong>registrados</strong>. El monto
          considerado puede ser menor si alguna orden del grupo está anulada.
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
          titulo="Evolución del gasto"
          descripcion="Comparación entre meses y entre años."
        >
          <Aviso tono="info" titulo="Todavía no hay evolución que mostrar">
            Con un único periodo cargado ({resumen.primerPeriodo}) no hay tendencia que comparar:
            un gráfico de un solo punto parece un error. Estas dos vistas se completarán solas al
            importar los siguientes libros mensuales.
          </Aviso>
        </Seccion>
      ) : (
        <Seccion titulo="Evolución del gasto" descripcion="Comparación entre meses y entre años.">
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
          descripcion="Reparto por tipo de orden, sobre el monto registrado."
        >
          <GraficoBarras barras={barrasTipoOrden} etiquetaSerie="Monto registrado" />
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

function Seccion({
  titulo,
  descripcion,
  accion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  const id = titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 id={id} className="text-lg font-semibold">
            {titulo}
          </h2>
          {descripcion ? <p className="text-sm text-muted-foreground">{descripcion}</p> : null}
        </div>
        {accion}
      </div>
      {children}
    </section>
  );
}
