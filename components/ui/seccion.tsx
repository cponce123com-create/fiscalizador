import type { ReactNode } from 'react';

/**
 * Sección con título y descripción.
 *
 * El `id` se deriva del título para que el encabezado quede enlazado con su región
 * (`aria-labelledby`) sin tener que pasar un identificador a mano en cada uso.
 */
export function Seccion({
  titulo,
  descripcion,
  accion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
  children: ReactNode;
}) {
  const id = titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id={id} className="text-lg font-semibold">
            {titulo}
          </h2>
          {descripcion ? <p className="text-sm text-muted-foreground">{descripcion}</p> : null}
        </div>
        {accion ? <div className="w-full sm:w-auto">{accion}</div> : null}
      </div>
      {children}
    </section>
  );
}
