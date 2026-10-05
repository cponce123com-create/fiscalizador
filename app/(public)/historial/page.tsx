import type { Metadata } from 'next';

import { EnlaceFiltro } from '@/components/publico/filtros';
import { TablaHistorial } from '@/components/publico/tabla-historial';
import { Aviso } from '@/components/ui/data';
import { leerFiltros } from '@/lib/filtros';
import { proveedoresMultiGestion } from '@/services/statisticsService';

/**
 * Historial por gestiones.
 *
 * Responde a una pregunta distinta a la del ranking: no «quién cobró más», sino
 * «quién ha trabajado con la entidad a lo largo de varios periodos de gobierno».
 * Por eso el filtro no es de texto sino del número mínimo de gestiones.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Historial por gestiones',
  description:
    'Proveedores que han recibido órdenes en más de una gestión de gobierno, con el detalle por periodo.',
};

export default async function PaginaHistorial({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filtros = leerFiltros(await searchParams);
  const minimo = filtros.minimoGestiones ?? 2;

  const { filas, maximoGestiones, totalProveedores } = await proveedoresMultiGestion(minimo);

  // Se ofrecen tantas opciones como gestiones haya registradas como máximo. Si solo
  // hay una cargada, la única opción posible es 1.
  const opciones: number[] = [];
  for (let n = 1; n <= Math.max(maximoGestiones, 1); n++) opciones.push(n);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">Historial por gestiones</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Proveedores que aparecen en varios periodos de gobierno. Un proveedor que trabaja con la
          entidad gestión tras gestión es un dato que el ranking, por sí solo, no muestra.
        </p>
      </header>

      {maximoGestiones < 2 ? (
        <Aviso tono="info" titulo="Todavía no hay historial que comparar">
          Con un solo libro cargado, ningún proveedor aparece en dos gestiones distintas: el
          historial se completará al importar los libros de otras gestiones. Mientras tanto puedes
          consultar los {totalProveedores} proveedores de la gestión actual bajando el mínimo a una
          gestión.
        </Aviso>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Mostrar proveedores en al menos</span>

        {opciones.map((n) => (
          <EnlaceFiltro
            key={n}
            filtros={filtros}
            ruta="/historial"
            cambios={{ minimoGestiones: n }}
            activo={minimo === n}
          >
            {n} {n === 1 ? 'gestión' : 'gestiones'}
          </EnlaceFiltro>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {filas.length} de {totalProveedores} proveedores. El máximo observado es {maximoGestiones}{' '}
        {maximoGestiones === 1 ? 'gestión' : 'gestiones'}.
      </p>

      <TablaHistorial filas={filas} />
    </div>
  );
}
