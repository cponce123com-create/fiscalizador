'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { BarChart3, Home, ListChecks, Trophy, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
const principales = [
  {href:'/', etiqueta:'Inicio', icono: Home},
  {href:'/ordenes', etiqueta:'Órdenes', icono: ListChecks},
  {href:'/proveedores', etiqueta:'Proveedores', icono: Users},
  {href:'/ranking', etiqueta:'Ranking', icono: Trophy},
  {href:'/estadisticas', etiqueta:'Estadísticas', icono: BarChart3},
];
const secundarios = [{href:'/fuentes', etiqueta:'Fuentes y cobertura'}, {href:'/prensa', etiqueta:'¿Y la prensa cuánto cobra?'}, {href:'/historial', etiqueta:'Historial por gestión'}, {href:'/vinculos', etiqueta:'Vínculos documentados'}, {href:'/electoral', etiqueta:'Antecedentes electorales'}];
export function NavPublica() {
  const ruta = usePathname();
  const searchParams = useSearchParams();
  const municipalidad = searchParams.get('municipalidad');
  const conMunicipalidad = (href: string) => {
    if (!municipalidad) return href;
    const params = new URLSearchParams();
    params.set('municipalidad', municipalidad);
    return `${href}?${params.toString()}`;
  };
  const estilo = (activo: boolean) => cn('block min-h-11 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors', activo ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground');
  const activo = (href: string) => href === '/' ? ruta === '/' : ruta.startsWith(href);
  return <><nav aria-label="Menú móvil del portal" className="md:hidden"><details className="relative"><summary className="boton-enlace min-h-11 cursor-pointer rounded-lg border border-control px-4 py-3 text-sm font-semibold">Más secciones</summary><div className="absolute left-0 z-40 mt-2 grid w-[min(20rem,calc(100vw-2rem))] grid-cols-1 gap-1 rounded-xl border border-border bg-card p-2 shadow-xl">{secundarios.map(e => <Link key={e.href} href={conMunicipalidad(e.href)} className={estilo(activo(e.href))} aria-current={activo(e.href) ? 'page' : undefined} onClick={event => event.currentTarget.closest('details')?.removeAttribute('open')}>{e.etiqueta}</Link>)}</div></details></nav><nav aria-label="Secciones del portal" className="hidden flex-wrap items-center gap-1 md:flex">
    {principales.map(e => <Link key={e.href} href={conMunicipalidad(e.href)} aria-current={activo(e.href) ? 'page' : undefined} className={estilo(activo(e.href))}>{e.etiqueta}</Link>)}
    <details className="relative"><summary className={`${estilo(secundarios.some(e => ruta.startsWith(e.href)))} cursor-pointer`}>Más</summary><div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-border bg-card p-2 shadow-lg">{secundarios.map(e => <Link key={e.href} href={conMunicipalidad(e.href)} aria-current={ruta.startsWith(e.href) ? 'page' : undefined} className={estilo(ruta.startsWith(e.href))} onClick={event => event.currentTarget.closest('details')?.removeAttribute('open')}>{e.etiqueta}</Link>)}</div></details>
  </nav><nav aria-label="Accesos principales" className="barra-movil fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-border bg-card/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(23,37,29,.12)] backdrop-blur md:hidden">
    {principales.map(e => { const Icono = e.icono; const seleccionado = activo(e.href); return <Link key={e.href} href={conMunicipalidad(e.href)} aria-current={seleccionado ? 'page' : undefined} className={cn('flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-semibold leading-none', seleccionado ? 'text-primary' : 'text-muted-foreground')}><Icono size={19} strokeWidth={seleccionado ? 2.5 : 2} aria-hidden="true" /><span className="max-w-full truncate">{e.etiqueta}</span></Link>; })}
  </nav></>;
}
