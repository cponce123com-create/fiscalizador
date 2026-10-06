import Image from 'next/image';
import Link from 'next/link';
import { NavPublica } from '@/components/publico/nav-publica';
import { CintaTitulares } from '@/components/publico/cinta-titulares';
import { leerConfiguracionPortal } from '@/services/portalService';

export const dynamic = 'force-dynamic';
export default async function LayoutPublico({ children }: { children: React.ReactNode }) {
  const config = await leerConfiguracionPortal();
  return <div className="flex min-h-full flex-col">
    <a href="#contenido" className="sr-only z-50 rounded bg-card p-3 focus:not-sr-only focus:absolute">Ir al contenido</a>
    <header className="border-b border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3"><span className="h-12 w-1 rounded-full bg-amber-500" aria-hidden="true" /><span><span className="block text-2xl font-bold tracking-tight">Fiscalizador <span className="text-primary">· San Ramón</span></span><span className="text-xs text-muted-foreground">Vigilancia ciudadana independiente</span></span></Link>
          <div className="flex max-w-xs items-center gap-3"><Image src="/identidad/escudo-san-ramon.webp" alt="Escudo de San Ramón" width={44} height={45} className="rounded bg-white p-1" /><div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Municipalidad consultada</p><p className="text-xs font-medium">{config.municipio}</p></div></div>
        </div>
        <NavPublica />
      </div>
    </header>
    <CintaTitulares config={config} />
    <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    <footer className="mt-6 border-t border-border bg-card"><div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-2 sm:px-6">
      <div><p className="font-semibold">Fiscalizador · San Ramón</p><p className="mt-2 max-w-lg text-xs leading-relaxed text-muted-foreground">Portal ciudadano independiente. Datos obtenidos de libros mensuales publicados en el Portal de Transparencia de la municipalidad. Las órdenes registradas no acreditan pagos realizados.</p></div>
      <div className="flex flex-wrap items-start gap-4 text-sm"><Link href="/fuentes">Fuentes y cobertura</Link><Link href="/metodologia">Metodología</Link><Link href="/admin" className="text-muted-foreground">Administración</Link></div>
    </div></footer>
  </div>;
}
