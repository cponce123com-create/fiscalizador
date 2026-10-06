import type { Metadata } from 'next';

import { Filtros } from '@/components/publico/filtros';
import { Paginacion } from '@/components/publico/paginacion';
import { TablaOrdenes } from '@/components/publico/tabla-ordenes';
import Link from 'next/link';
import { leerFiltros, serializarFiltros } from '@/lib/filtros';
import { listarOrdenes, opcionesDeFiltros } from '@/services/statisticsService';

/**
 * Listado público de órdenes.
 *
 * Los filtros se leen de la URL y la consulta se hace en PostgreSQL con ellos
 * aplicados: al navegador solo llega la página de resultados. La paginación usa
 * `skip`/`take`, no un corte en memoria.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Órdenes',
  description:
    'Listado de órdenes de compra y de servicio registradas, con filtros por año, mes, gestión, tipo y estado.',
};

export default async function PaginaOrdenes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filtros = leerFiltros(await searchParams);

  const [resultado, opciones] = await Promise.all([
    listarOrdenes(filtros),
    opcionesDeFiltros(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold sm:text-3xl">Órdenes</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Todas las órdenes de compra y de servicio cargadas, tal como figuran en los libros
          mensuales. Las órdenes anuladas aparecen marcadas y no se suman al monto considerado.
        </p>
      </div>

      <Filtros filtros={filtros} opciones={opciones} ruta="/ordenes" />

      <Link className="underline" href={`/api/public/orders/export?${serializarFiltros(filtros)}`}>Descargar todo el resultado filtrado (CSV, hasta 20.000 órdenes)</Link>
      <p className="text-xs text-muted-foreground">Extracto normalizado de versiones vigentes con procedencia y criterio de búsqueda. Las columnas restringidas se omiten; la huella corresponde al original. El monto considerado se reproduce sumando el monto de las filas con considerada=true. Los montos desconocidos quedan vacíos.</p>
      <Paginacion filtros={filtros} total={resultado.total} ruta="/ordenes" />

      <TablaOrdenes ordenes={resultado.filas} />

      <Paginacion filtros={filtros} total={resultado.total} ruta="/ordenes" />
    </div>
  );
}
