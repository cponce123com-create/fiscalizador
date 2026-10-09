'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
const principales = [{href:'/', etiqueta:'Inicio'}, {href:'/ordenes', etiqueta:'Órdenes'}, {href:'/proveedores', etiqueta:'Proveedores'}, {href:'/ranking', etiqueta:'Ranking'}, {href:'/estadisticas', etiqueta:'Estadísticas'}];
const secundarios = [{href:'/fuentes', etiqueta:'Fuentes y cobertura'}, {href:'/prensa', etiqueta:'¿Y la prensa cuánto cobra?'}, {href:'/historial', etiqueta:'Historial por gestión'}, {href:'/vinculos', etiqueta:'Vínculos documentados'}, {href:'/electoral', etiqueta:'Antecedentes electorales'}];
export function NavPublica() {
  const ruta = usePathname();
  const estilo = (activo: boolean) => cn('block min-h-11 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors', activo ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground');
  const activo = (href: string) => href === '/' ? ruta === '/' : ruta.startsWith(href);
  return <><nav aria-label="Menú móvil del portal" className="md:hidden"><details className="relative"><summary className="boton-enlace min-h-11 cursor-pointer rounded-lg border border-control px-4 py-3 text-sm font-semibold">Menú</summary><div className="absolute left-0 z-40 mt-2 grid w-[min(20rem,calc(100vw-2rem))] grid-cols-2 gap-1 rounded-xl border border-border bg-card p-2 shadow-xl">{[...principales, ...secundarios].map(e => <Link key={e.href} href={e.href} className={estilo(activo(e.href))} aria-current={activo(e.href) ? 'page' : undefined} onClick={event => event.currentTarget.closest('details')?.removeAttribute('open')}>{e.etiqueta}</Link>)}</div></details></nav><nav aria-label="Secciones del portal" className="hidden flex-wrap items-center gap-1 md:flex">
    {principales.map(e => <Link key={e.href} href={e.href} aria-current={activo(e.href) ? 'page' : undefined} className={estilo(activo(e.href))}>{e.etiqueta}</Link>)}
    <details className="relative"><summary className={`${estilo(secundarios.some(e => ruta.startsWith(e.href)))} cursor-pointer`}>Más</summary><div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-border bg-card p-2 shadow-lg">{secundarios.map(e => <Link key={e.href} href={e.href} aria-current={ruta.startsWith(e.href) ? 'page' : undefined} className={estilo(ruta.startsWith(e.href))} onClick={event => event.currentTarget.closest('details')?.removeAttribute('open')}>{e.etiqueta}</Link>)}</div></details>
  </nav></>;
}
