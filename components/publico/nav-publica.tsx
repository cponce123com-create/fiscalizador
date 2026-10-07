'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
const principales = [{href:'/', etiqueta:'Inicio'}, {href:'/ordenes', etiqueta:'Órdenes'}, {href:'/proveedores', etiqueta:'Proveedores'}, {href:'/fuentes', etiqueta:'Fuentes'}];
const analisis = [{href:'/estadisticas', etiqueta:'Estadísticas'}, {href:'/ranking', etiqueta:'Ranking de proveedores'}, {href:'/historial', etiqueta:'Historial por gestión'}, {href:'/vinculos', etiqueta:'Vínculos documentados'}];
export function NavPublica() {
  const ruta = usePathname();
  const estilo = (activo: boolean) => cn('block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors', activo ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground');
  return <nav aria-label="Secciones del portal" className="flex flex-wrap items-center gap-1">
    {principales.slice(0,3).map(e => <Link key={e.href} href={e.href} aria-current={(e.href === '/' ? ruta === '/' : ruta.startsWith(e.href)) ? 'page' : undefined} className={estilo(e.href === '/' ? ruta === '/' : ruta.startsWith(e.href))}>{e.etiqueta}</Link>)}
    <details className="relative"><summary className={`${estilo(analisis.some(e => ruta.startsWith(e.href)))} cursor-pointer`}>Análisis</summary><div className="absolute left-0 z-30 mt-2 w-60 rounded-xl border border-border bg-card p-2 shadow-lg">{analisis.map(e => <Link key={e.href} href={e.href} aria-current={ruta.startsWith(e.href) ? 'page' : undefined} className={estilo(ruta.startsWith(e.href))} onClick={event => event.currentTarget.closest('details')?.removeAttribute('open')}>{e.etiqueta}</Link>)}</div></details>
    <Link href="/fuentes" className={estilo(ruta.startsWith('/fuentes'))} aria-current={ruta.startsWith('/fuentes') ? 'page' : undefined}>Fuentes</Link>
  </nav>;
}
