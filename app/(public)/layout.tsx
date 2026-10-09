import Link from 'next/link';
import { NavPublica } from '@/components/publico/nav-publica';
import { CintaTitulares } from '@/components/publico/cinta-titulares';
import { leerConfiguracionPortal } from '@/services/portalService';
import { IndicadoresLocales } from '@/components/publico/contexto-local';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { SelectorMunicipalidad } from '@/components/publico/selector-municipalidad';
import { listarMunicipalidadesActivas } from '@/services/municipalityService';
import { MarcaPublica, PiePublico } from '@/components/publico/identidad-municipal-publica';

export const dynamic = 'force-dynamic';
export default async function LayoutPublico({ children }: { children: React.ReactNode }) {
  const [config, municipalidades] = await Promise.all([
    leerConfiguracionPortal(),
    listarMunicipalidadesActivas(),
  ]);
  return <div className="portal-publico flex min-h-full flex-col">
    <a href="#contenido" className="sr-only z-50 rounded bg-card p-3 focus:not-sr-only focus:absolute">Ir al contenido</a>
    <div className="bg-emerald-950 text-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6"><p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.15em]"><ShieldCheck size={14} aria-hidden="true" />Información pública verificable</p><IndicadoresLocales /></div></div>
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:gap-5 sm:py-5 sm:px-6">
          <MarcaPublica config={config} municipalidades={municipalidades} />
          <div className="flex w-full flex-wrap items-center justify-between gap-3 md:w-auto"><SelectorMunicipalidad municipalidades={municipalidades} /><NavPublica /><Link href="/admin" className="boton-enlace inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted"><LockKeyhole size={14} aria-hidden="true" />Acceso admin</Link></div>
      </div>
    </header>
    <CintaTitulares config={config} />
    <main id="contenido" className="mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-10">{children}</main>
    <PiePublico config={config} municipalidades={municipalidades} />
  </div>;
}
