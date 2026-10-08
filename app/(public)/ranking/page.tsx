import { TipoRucRanking } from '@/components/publico/tipo-ruc-ranking';
import type { Metadata } from 'next';

import { Filtros } from '@/components/publico/filtros';
import { Paginacion } from '@/components/publico/paginacion';
import { TablaRanking } from '@/components/publico/tabla-ranking';
import { PeriodoRanking } from '@/components/publico/periodo-ranking';
import { seleccionarPeriodoRanking } from '@/lib/periodo-ranking';
import { leerFiltros } from '@/lib/filtros';
import { periodosDelRanking, rankingCompleto } from '@/services/statisticsService';

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
    'Proveedores ordenados por monto considerado y su peso sobre el total público.',
};

export default async function PaginaRanking({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametros = await searchParams;
  const periodos = await periodosDelRanking();
  const filtros = leerFiltros(parametros);
  filtros.gestionId = seleccionarPeriodoRanking(parametros.gestion, periodos);
  const resultado = await rankingCompleto(filtros);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">Ranking de proveedores</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Ordenados por monto considerado, según el catálogo de estados: excluye las órdenes
          anuladas. El importe agregado de anuladas no se publica. El peso es la participación
          de cada proveedor sobre el total del conjunto filtrado.
        </p>
      </header>

      <PeriodoRanking periodos={periodos} seleccionado={filtros.gestionId} />
      <TipoRucRanking filtros={filtros} ruta="/ranking" />

      <Filtros
        filtros={filtros}
        ruta="/ranking"
        campos={['texto']}
        opciones={{ gestiones: [...periodos, { id: 'todas', nombre: 'Todos los periodos' }] }}
      />

      <Paginacion filtros={filtros} total={resultado.total} ruta="/ranking" />

      <TablaRanking filas={resultado.filas} />

      <Paginacion filtros={filtros} total={resultado.total} ruta="/ranking" />
    </div>
  );
}
