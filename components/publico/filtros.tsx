import { Search, X } from 'lucide-react';
import Link from 'next/link';

import { hayFiltrosActivos, serializarFiltros } from '@/lib/filtros';
import type { Filtros } from '@/lib/filtros';

/**
 * Controles de filtro.
 *
 * Es un formulario `GET` sin una línea de JavaScript de cliente: al enviarlo, el
 * navegador pone los valores en la URL y Next.js vuelve a renderizar la página en
 * el servidor con ellos. Tres ventajas frente a filtrar en el navegador:
 *
 * - La consulta se hace en PostgreSQL con los filtros aplicados. Al navegador solo
 *   llega la página de resultados, no las 103 órdenes ni las que haya en el futuro.
 * - La URL resultante se puede compartir.
 * - Funciona sin JavaScript.
 *
 * `campos` decide qué controles se muestran. Cada pantalla ofrece solo los filtros
 * que su consulta sabe aplicar: un desplegable que no cambia nada es peor que no
 * tenerlo. Por defecto se muestran todos, que es lo que quiere el listado de órdenes.
 */

export type CampoFiltro =
  | 'texto'
  | 'anio'
  | 'mes'
  | 'gestion'
  | 'tipoOrden'
  | 'estado'
  | 'tipoRuc'
  | 'rango';

const TODOS_LOS_CAMPOS: readonly CampoFiltro[] = [
  'texto',
  'anio',
  'mes',
  'gestion',
  'tipoOrden',
  'estado',
  'tipoRuc',
  'rango',
];

export type OpcionesFiltros = {
  anios?: number[];
  gestiones?: { id: string; nombre: string }[];
  tiposOrden?: { id: string; etiqueta: string }[];
  estados?: { id: string; etiqueta: string }[];
};

export function Filtros({
  filtros,
  opciones = {},
  ruta,
  campos = TODOS_LOS_CAMPOS,
}: {
  filtros: Filtros;
  opciones?: OpcionesFiltros;
  ruta: string;
  campos?: readonly CampoFiltro[];
}) {
  const activos = hayFiltrosActivos(filtros);
  const hay = (campo: CampoFiltro): boolean => campos.includes(campo);

  return (
    <form method="get" action={ruta} className="rounded-lg border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {hay('texto') ? (
          <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
            <span className="text-xs font-medium text-muted-foreground">Buscar</span>
            <span className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                name="texto"
                defaultValue={filtros.texto ?? ''}
                placeholder="Razón social, RUC, nº de orden…"
                className="w-full rounded-md border border-input bg-background py-2 pl-8 pr-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </span>
          </label>
        ) : null}

        {hay('anio') ? (
          <Selector
            etiqueta="Año"
            nombre="anio"
            valor={filtros.anio === null ? '' : String(filtros.anio)}
            opciones={(opciones.anios ?? []).map((a) => ({ valor: String(a), etiqueta: String(a) }))}
            vacio="Todos"
          />
        ) : null}

        {hay('mes') ? (
          <Selector
            etiqueta="Mes"
            nombre="mes"
            valor={filtros.mes === null ? '' : String(filtros.mes)}
            opciones={MESES.map((nombre, indice) => ({
              valor: String(indice + 1),
              etiqueta: nombre,
            }))}
            vacio="Todos"
          />
        ) : null}

        {hay('gestion') ? (
          <Selector
            etiqueta="Gestión"
            nombre="gestion"
            valor={filtros.gestionId ?? ''}
            opciones={(opciones.gestiones ?? []).map((g) => ({ valor: g.id, etiqueta: g.nombre }))}
            vacio="Todas"
          />
        ) : null}

        {hay('tipoOrden') ? (
          <Selector
            etiqueta="Tipo de orden"
            nombre="tipoOrden"
            valor={filtros.tipoOrdenId ?? ''}
            opciones={(opciones.tiposOrden ?? []).map((t) => ({
              valor: t.id,
              etiqueta: t.etiqueta,
            }))}
            vacio="Todos"
          />
        ) : null}

        {hay('estado') ? (
          <Selector
            etiqueta="Estado"
            nombre="estado"
            valor={filtros.estadoId ?? ''}
            opciones={(opciones.estados ?? []).map((e) => ({ valor: e.id, etiqueta: e.etiqueta }))}
            vacio="Todos"
          />
        ) : null}

        {hay('tipoRuc') ? (
          <Selector
            etiqueta="Tipo de RUC"
            nombre="tipoRuc"
            valor={filtros.tipoRuc ?? ''}
            opciones={[
              { valor: '10', etiqueta: 'RUC 10 · persona natural' },
              { valor: '20', etiqueta: 'RUC 20 · persona jurídica' },
            ]}
            vacio="Todos"
          />
        ) : null}

        {hay('rango') ? (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Desde</span>
              <input
                type="date"
                name="desde"
                defaultValue={filtros.desde ?? ''}
                className="rounded-md border border-input bg-background px-2.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Hasta</span>
              <input
                type="date"
                name="hasta"
                defaultValue={filtros.hasta ?? ''}
                className="rounded-md border border-input bg-background px-2.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          </>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Aplicar filtros
        </button>

        {activos ? (
          <Link
            href={ruta}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Quitar filtros
          </Link>
        ) : null}
      </div>
    </form>
  );
}

/** Enlace para cambiar solo un filtro conservando los demás. */
export function EnlaceFiltro({
  filtros,
  ruta,
  cambios,
  children,
  activo = false,
}: {
  filtros: Filtros;
  ruta: string;
  cambios: Partial<Filtros>;
  children: React.ReactNode;
  activo?: boolean;
}) {
  return (
    <Link
      href={`${ruta}${serializarFiltros(filtros, { ...cambios, pagina: 1 })}`}
      aria-current={activo ? 'true' : undefined}
      className={
        activo
          ? 'rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary'
          : 'rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted'
      }
    >
      {children}
    </Link>
  );
}

function Selector({
  etiqueta,
  nombre,
  valor,
  opciones,
  vacio,
}: {
  etiqueta: string;
  nombre: string;
  valor: string;
  opciones: { valor: string; etiqueta: string }[];
  vacio: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{etiqueta}</span>
      <select
        name={nombre}
        defaultValue={valor}
        className="rounded-md border border-input bg-background px-2.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">{vacio}</option>
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.etiqueta}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Nombres de mes en español, sin depender de la configuración regional del servidor. */
const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Setiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];
