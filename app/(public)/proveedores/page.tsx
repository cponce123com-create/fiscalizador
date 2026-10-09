import type { Metadata } from 'next';

import { BusquedaProveedores } from '@/components/publico/busqueda-proveedores';
import { Paginacion } from '@/components/publico/paginacion';
import { TablaProveedores } from '@/components/publico/tabla-proveedores';
import { Anunciador } from '@/components/ui/anunciador';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { leerFiltros } from '@/lib/filtros';
import { listarProveedores } from '@/services/statisticsService';

/**
 * Listado de proveedores.
 *
 * Es un Server Component y se renderiza en cada petición: las cifras deben reflejar
 * lo que hay en la base de datos ahora mismo, no lo que había en el build.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Proveedores',
  description:
    'Proveedores que han recibido órdenes de compra o de servicio, con su monto considerado y el periodo en que aparecen.',
};

export default async function PaginaProveedores({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filtros = leerFiltros(await searchParams);
  const resultado = await listarProveedores(filtros);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: 'Proveedores' }]} />
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">Proveedores</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Quién ha recibido órdenes de compra y de servicio. Al buscar, las coincidencias exactas
          aparecen primero; sin búsqueda, se ordenan alfabéticamente. El monto
          considerado excluye las órdenes anuladas y las de estados excluidos del análisis.
        </p>
      </header>

      <BusquedaProveedores filtros={filtros} />
      <Anunciador mensaje={`${resultado.total} proveedores encontrados`} />

      <Paginacion filtros={filtros} total={resultado.total} ruta="/proveedores" />

      <TablaProveedores proveedores={resultado.filas} />

      <Paginacion filtros={filtros} total={resultado.total} ruta="/proveedores" />
    </div>
  );
}
