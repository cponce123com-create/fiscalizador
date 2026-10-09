import Link from 'next/link';

import { EstadoVacio } from '@/components/ui/data';
import { formatearFecha, formatearMonto } from '@/lib/utils';
import type { FilaProveedorListado } from '@/services/statisticsService';

/**
 * Listado alfabético de proveedores.
 *
 * Cada fila enlaza al perfil, que es donde está el detalle. La primera y la última
 * aparición se muestran como fechas y no como años: el pliego pide el año, pero la
 * fecha completa es más informativa y no cuesta nada, porque el servicio ya la
 * calcula con `MIN`/`MAX` sobre `issueDate`.
 */
export function TablaProveedores({ proveedores }: { proveedores: FilaProveedorListado[] }) {
  if (proveedores.length === 0) {
    return (
      <EstadoVacio
        titulo="Sin proveedores coincidentes"
        descripcion="La búsqueda acepta nombres en distinto orden. Prueba con un apellido, RUC o menos palabras."
      >
        <Link href="/proveedores" className="boton-enlace rounded-lg px-4 py-2 text-sm text-primary">Ver todos los proveedores</Link>
      </EstadoVacio>
    );
  }

  return (
    <><div className="grid gap-3 md:hidden">{proveedores.map(p => <article key={p.id} className="min-w-0 rounded-xl border border-border bg-card p-4"><Link href={`/proveedores/${p.slug}`} className="block break-words text-base font-semibold text-primary">{p.nombre}</Link><p className="mt-1 text-xs text-muted-foreground">RUC {p.ruc} · {p.tipo}</p><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">Monto considerado</dt><dd className="tabular break-words font-semibold">{formatearMonto(p.considerado)}</dd></div><div><dt className="text-xs text-muted-foreground">Órdenes</dt><dd>{p.ordenes.toLocaleString('es-PE')}</dd></div><div><dt className="text-xs text-muted-foreground">Primera aparición</dt><dd>{p.primeraAparicion ? formatearFecha(p.primeraAparicion) : '—'}</dd></div><div><dt className="text-xs text-muted-foreground">Última aparición</dt><dd>{p.ultimaAparicion ? formatearFecha(p.ultimaAparicion) : '—'}</dd></div></dl><Link href={`/proveedores/${p.slug}`} className="mt-3 inline-flex min-h-11 items-center text-sm text-primary underline">Ver perfil y órdenes</Link></article>)}</div>
    <div className="hidden md:block overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Proveedor
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tipo
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Órdenes
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Monto considerado
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Primera aparición
            </th>
            <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Última aparición
            </th>
          </tr>
        </thead>

        <tbody>
          {proveedores.map((proveedor) => (
            <tr key={proveedor.id} className="border-t border-border align-top">
              <td className="max-w-[22rem] px-3 py-2.5">
                <Link
                  href={`/proveedores/${proveedor.slug}`}
                  className="line-clamp-2 font-medium hover:underline"
                  title={proveedor.nombre}
                >
                  {proveedor.nombre}
                </Link>
                <span className="tabular block text-xs text-muted-foreground">{proveedor.ruc}</span>
              </td>

              <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                {proveedor.tipo}
              </td>

              <td className="tabular whitespace-nowrap px-3 py-2.5 text-right">
                {proveedor.ordenes.toLocaleString('es-PE')}
              </td>

              <td className="tabular whitespace-nowrap px-3 py-2.5 text-right font-medium">
                {formatearMonto(proveedor.considerado)}
              </td>

              <td className="tabular whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                {proveedor.primeraAparicion ? formatearFecha(proveedor.primeraAparicion) : '—'}
              </td>

              <td className="tabular whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                {proveedor.ultimaAparicion ? formatearFecha(proveedor.ultimaAparicion) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div></>
  );
}
