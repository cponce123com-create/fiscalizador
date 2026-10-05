import type { Metadata } from 'next';

import { Filtros } from '@/components/publico/filtros';
import { Paginacion } from '@/components/publico/paginacion';
import { TablaRanking } from '@/components/publico/tabla-ranking';
import { leerFiltros } from '@/lib/filtros';
import { opcionesDeFiltros, rankingCompleto } from '@/services/statisticsService';

/**
 * Ranking de proveedores por monto considerado.
 *
 * La posición se calcula sobre el conjunto filtrado, no sobre el total global: al
 * filtrar por RUC 20, el primer proveedor de ese subconjunto vuelve a ser el
 * número 1. Si no fuera así, el ranking filtrado mostraría posiciones salteadas.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ranking de proveedores',
  description:
    'Proveedores ordenados por monto considerado, con su peso sobre el total y los montos registrado y anulado.',
};

export default async function PaginaRanking({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filtros = leerFiltros(await searchParams);

  const [resultado, opciones] = await Promise.all([
    rankingCompleto(filtros),
    opcionesDeFiltros(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">Ranking de proveedores</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Ordenados por monto considerado, que es lo que de verdad suma: excluye las órdenes
          anuladas. El peso es la participación de cada proveedor sobre el total del conjunto
          filtrado.
        </p>
      </header>

      <Filtros
        filtros={filtros}
        ruta="/ranking"
        campos={['texto', 'gestion', 'tipoRuc']}
        opciones={{ gestiones: opciones.gestiones }}
      />

      <Paginacion filtros={filtros} total={resultado.total} ruta="/ranking" />

      <TablaRanking filas={resultado.filas} />

      <Paginacion filtros={filtros} total={resultado.total} ruta="/ranking" />
    </div>
  );
}
