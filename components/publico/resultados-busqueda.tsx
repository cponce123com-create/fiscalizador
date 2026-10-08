import Link from 'next/link';
import { Users, FileSearch } from 'lucide-react';
import type { ResultadoBusquedaPublica } from '@/lib/busqueda-publica';
import { TextoCoincidente } from './texto-coincidente';

export function ResultadosBusqueda({ resultado, texto }: { resultado: ResultadoBusquedaPublica; texto: string }) {
  const consulta = encodeURIComponent(texto.trim());
  return <div className="mt-3 flex flex-col gap-5 rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
    <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">Mostramos primero proveedores porque el vecino suele buscar nombres conocidos; debajo aparecen órdenes y conceptos.</p>
    {resultado.totalProveedores > 0 ? <section aria-label="Proveedores coincidentes">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Users size={17} aria-hidden="true" />Proveedores ({resultado.totalProveedores.toLocaleString('es-PE')})</h2>
      <ul className="divide-y divide-border">{resultado.proveedores.map(p => <li key={p.id}><Link href={`/proveedores/${p.slug}`} className="block rounded-lg p-3 hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"><span className="block break-words text-sm font-semibold"><TextoCoincidente texto={p.nombre} consulta={texto} /></span><span className="mt-1 block text-xs text-muted-foreground">RUC {p.ruc} · {p.ordenes} {p.ordenes === 1 ? 'orden' : 'órdenes'} · Ver ficha del proveedor</span></Link></li>)}</ul>
      <Link href={`/proveedores?texto=${consulta}`} className="boton-enlace mt-2 inline-flex min-h-11 items-center rounded-lg border border-border px-3 py-2 text-sm font-semibold text-primary">Ver todos los proveedores coincidentes</Link>
    </section> : null}
    {resultado.total > 0 ? <section aria-label="Órdenes coincidentes">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><FileSearch size={17} aria-hidden="true" />Órdenes y compras ({resultado.total.toLocaleString('es-PE')})</h2>
      <ul className="divide-y divide-border">{resultado.filas.map(f => <li key={f.id}><Link href={`/ordenes/${f.id}`} className="block rounded-lg p-3 hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"><span className="block break-words text-sm font-semibold">Orden {f.numero} · <TextoCoincidente texto={f.proveedor} consulta={texto} /></span><span className="mt-1 block line-clamp-3 break-words text-sm text-muted-foreground"><TextoCoincidente texto={f.descripcion ?? 'Sin descripción'} consulta={texto} /></span></Link></li>)}</ul>
      <Link href={`/ordenes?texto=${consulta}`} className="boton-enlace mt-2 inline-flex min-h-11 items-center rounded-lg border border-border px-3 py-2 text-sm font-semibold text-primary">Ver todas las órdenes coincidentes</Link>
    </section> : null}
    {!resultado.totalProveedores && !resultado.total ? <p className="p-2 text-sm text-muted-foreground">No hay proveedores ni órdenes que coincidan. Prueba con otro nombre, RUC o descripción.</p> : null}
  </div>;
}
