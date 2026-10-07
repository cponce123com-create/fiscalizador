import Image from 'next/image';
import Link from 'next/link';
import { NavPublica } from '@/components/publico/nav-publica';
import { CintaTitulares } from '@/components/publico/cinta-titulares';
import { leerConfiguracionPortal } from '@/services/portalService';
import { IndicadoresLocales } from '@/components/publico/contexto-local';
import { LockKeyhole, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';
export default async function LayoutPublico({ children }: { children: React.ReactNode }) {
  const config = await leerConfiguracionPortal();
  return <div className="portal-publico flex min-h-full flex-col">
    <a href="#contenido" className="sr-only z-50 rounded bg-card p-3 focus:not-sr-only focus:absolute">Ir al contenido</a>
    <div className="bg-emerald-950 text-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6"><p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.15em]"><ShieldCheck size={14} aria-hidden="true" />Información pública verificable</p><IndicadoresLocales /></div></div>
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:gap-5 sm:py-5 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3"><Image src={config.logo || "/identidad/escudo-san-ramon.webp"} alt={config.logo ? "Logo del portal" : "Escudo de San Ramón"} width={52} height={54} className="h-11 w-14 shrink-0 object-contain sm:h-14 sm:w-16" /><span><span className="titulo-editorial block text-lg font-bold tracking-tight text-emerald-950 sm:text-2xl">Fiscalizador · San Ramón</span><span className="text-[11px] text-muted-foreground">Vigilancia ciudadana independiente</span></span></Link>
          <div className="flex w-full items-center justify-between gap-3 md:w-auto"><NavPublica /><Link href="/admin" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted"><LockKeyhole size={14} aria-hidden="true" />Acceso admin</Link></div>
      </div>
    </header>
    <CintaTitulares config={config} />
    <main id="contenido" className="mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-10">{children}</main>
    <footer className="mt-6 bg-emerald-950 text-white"><div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-2 sm:px-6">
      <div className="flex items-start gap-3"><Image src={config.logo || "/identidad/escudo-san-ramon.webp"} alt="" width={42} height={44} className="h-11 w-11 shrink-0 object-contain" /><div><p className="titulo-editorial text-lg font-semibold">Fiscalizador · San Ramón</p><p className="mt-2 max-w-lg text-xs leading-relaxed text-emerald-100/80">Portal ciudadano independiente. Municipalidad consultada: {config.municipio}. Datos de libros mensuales publicados por la municipalidad; las órdenes no acreditan pagos.</p></div></div>
      <div className="flex flex-wrap items-start gap-4 text-sm text-emerald-100"><Link href="/fuentes" className="hover:underline">Fuentes y cobertura</Link><Link href="/metodologia" className="hover:underline">Metodología</Link><Link href="/admin" className="hover:underline">Administración</Link></div>
    </div></footer>
  </div>;
}
