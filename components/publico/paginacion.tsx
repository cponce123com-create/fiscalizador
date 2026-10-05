import Link from 'next/link';

import { serializarFiltros } from '@/lib/filtros';
import type { Filtros } from '@/lib/filtros';

/**
 * Paginación con enlaces.
 *
 * Los números de página son enlaces reales, no botones con JavaScript: se pueden
 * abrir en otra pestaña, copiar y compartir. En un portal de transparencia, poder
 * enlazar «la página 3 de estas órdenes» es parte del producto.
 *
 * Se conservan todos los filtros activos, así que navegar entre páginas no los
 * pierde. Vive en su propio módulo porque la usan tanto el listado de órdenes como
 * el de proveedores y el ranking.
 */
export function Paginacion({
  filtros,
  total,
  ruta,
}: {
  filtros: Filtros;
  total: number;
  ruta: string;
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / filtros.porPagina));
  const actual = Math.min(filtros.pagina, totalPaginas);

  if (totalPaginas <= 1) {
    return (
      <p className="text-xs text-muted-foreground">
        {total === 1 ? '1 resultado' : `${total.toLocaleString('es-PE')} resultados`}
      </p>
    );
  }

  // Se muestran como mucho siete páginas alrededor de la actual, para que la
  // paginación no ocupe dos líneas cuando hay cientos de páginas.
  const ventana = 2;
  const desde = Math.max(1, actual - ventana);
  const hasta = Math.min(totalPaginas, actual + ventana);
  const numeros: number[] = [];
  for (let n = desde; n <= hasta; n++) numeros.push(n);

  const enlace = (pagina: number): string => `${ruta}${serializarFiltros(filtros, { pagina })}`;

  const enlaceDeshabilitado =
    'pointer-events-none rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground opacity-50';
  const enlaceNormal =
    'rounded-md border border-border px-2.5 py-1.5 text-xs transition-colors hover:bg-muted';

  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        Página {actual} de {totalPaginas} · {total.toLocaleString('es-PE')} resultados
      </p>

      <div className="flex flex-wrap items-center gap-1">
        {actual > 1 ? (
          <Link href={enlace(actual - 1)} className={enlaceNormal} rel="prev">
            Anterior
          </Link>
        ) : (
          <span className={enlaceDeshabilitado}>Anterior</span>
        )}

        {desde > 1 ? (
          <>
            <Link href={enlace(1)} className={enlaceNormal}>
              1
            </Link>
            {desde > 2 ? <span className="px-1 text-xs text-muted-foreground">…</span> : null}
          </>
        ) : null}

        {numeros.map((numero) => (
          <Link
            key={numero}
            href={enlace(numero)}
            aria-current={numero === actual ? 'page' : undefined}
            className={
              numero === actual
                ? 'rounded-md border border-primary bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary'
                : enlaceNormal
            }
          >
            {numero}
          </Link>
        ))}

        {hasta < totalPaginas ? (
          <>
            {hasta < totalPaginas - 1 ? (
              <span className="px-1 text-xs text-muted-foreground">…</span>
            ) : null}
            <Link href={enlace(totalPaginas)} className={enlaceNormal}>
              {totalPaginas}
            </Link>
          </>
        ) : null}

        {actual < totalPaginas ? (
          <Link href={enlace(actual + 1)} className={enlaceNormal} rel="next">
            Siguiente
          </Link>
        ) : (
          <span className={enlaceDeshabilitado}>Siguiente</span>
        )}
      </div>
    </nav>
  );
}
