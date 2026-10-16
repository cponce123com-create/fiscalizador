'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight, BookOpenCheck, Database, Mail, MapPin, ShieldCheck } from 'lucide-react';

import type { MunicipalidadActiva } from '@/lib/municipalidad';

type ConfigIdentidad = {
  logo: string | null;
  municipio: string;
};
type ConfiguracionesIdentidad = Record<string, ConfigIdentidad>;

function municipalidadSeleccionada(municipalidades: MunicipalidadActiva[], slug: string | null): MunicipalidadActiva {
  return municipalidades.find((municipalidad) => municipalidad.slug === slug) ?? municipalidades[0] ?? {
    id: 'mun-san-ramon',
    slug: 'san-ramon',
    nombre: 'Municipalidad Distrital de San Ramón',
    nombreCorto: 'San Ramón',
    ruc: '20146657142',
    provincia: 'Chanchamayo',
    departamento: 'Junín',
    tipoEntidad: 'DISTRITAL',
  };
}

function conMunicipalidad(href: string, slug: string | null) {
  if (!slug || slug === 'san-ramon') return href;
  const [ruta, fragmento] = href.split('#', 2);
  const destino = `${ruta}${ruta.includes('?') ? '&' : '?'}municipalidad=${slug}`;
  return fragmento ? `${destino}#${fragmento}` : destino;
}

export function MarcaPublica({ configuraciones, municipalidades }: { configuraciones: ConfiguracionesIdentidad; municipalidades: MunicipalidadActiva[] }) {
  const searchParams = useSearchParams();
  const slug = searchParams.get('municipalidad');
  const municipalidad = municipalidadSeleccionada(municipalidades, slug);
  const config = configuraciones[municipalidad.slug] ?? configuraciones['san-ramon'];

  return (
    <Link href={conMunicipalidad('/', slug)} className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
      <Image
        src={config?.logo || '/identidad/escudo-san-ramon.webp'}
        alt={config?.logo ? `Logo del portal de ${municipalidad.nombreCorto}` : `Escudo de ${municipalidad.nombreCorto}`}
        width={52}
        height={54}
        className="h-10 w-11 shrink-0 object-contain sm:h-14 sm:w-16"
      />
      <span className="min-w-0">
        <span className="titulo-editorial block text-lg font-bold leading-tight tracking-tight text-emerald-950 sm:text-2xl">Fiscalizador</span>
        <span className="block truncate text-[11px] font-medium text-muted-foreground sm:text-xs">{municipalidad.nombreCorto} · Vigilancia ciudadana</span>
      </span>
    </Link>
  );
}

export function PiePublico({ configuraciones, municipalidades }: { configuraciones: ConfiguracionesIdentidad; municipalidades: MunicipalidadActiva[] }) {
  const searchParams = useSearchParams();
  const slug = searchParams.get('municipalidad');
  const municipalidad = municipalidadSeleccionada(municipalidades, slug);
  const config = configuraciones[municipalidad.slug] ?? configuraciones['san-ramon'];

  return (
    <footer className="relative mt-10 overflow-hidden border-t border-emerald-800 bg-[#032f29] text-white">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-teal-300/5 blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 sm:py-12 lg:grid-cols-[1.35fr_.65fr] lg:gap-16">
        <section aria-labelledby="pie-marca" className="max-w-2xl">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white p-2 shadow-lg shadow-black/15">
              <Image src={config?.logo || '/identidad/escudo-san-ramon.webp'} alt="" width={52} height={54} className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[.22em] text-emerald-300">Vigilancia ciudadana · Selva Central</p>
              <h2 id="pie-marca" className="titulo-editorial mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Fiscalizador</h2>
            </div>
          </div>

          <div className="mt-5 inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-300/20 bg-white/[.06] px-3 py-1.5 text-xs font-medium text-emerald-50">
            <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
            <span className="truncate">Consultando: {municipalidad.nombre}</span>
          </div>

          <p className="mt-4 max-w-xl text-sm leading-6 text-emerald-50/75">
            Organizamos libros y órdenes municipales para que cualquier vecino pueda consultar, comparar y verificar el uso de los recursos públicos.
          </p>

          <div className="mt-6 flex flex-wrap gap-2 text-[11px] font-semibold text-emerald-100/90">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/10 px-3 py-1.5"><Database aria-hidden="true" className="h-3.5 w-3.5 text-emerald-300" />Datos públicos</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/10 px-3 py-1.5"><BookOpenCheck aria-hidden="true" className="h-3.5 w-3.5 text-emerald-300" />Fuentes verificables</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/10 px-3 py-1.5"><ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 text-emerald-300" />Control ciudadano</span>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-x-6 gap-y-8">
          <nav aria-label="Información del portal">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-300">Información</p>
            <ul className="mt-4 space-y-3 text-sm text-emerald-50/80">
              <li><Link href={conMunicipalidad('/fuentes', slug)} className="transition-colors hover:text-white">Fuentes y cobertura</Link></li>
              <li><Link href={conMunicipalidad('/metodologia', slug)} className="transition-colors hover:text-white">Metodología</Link></li>
              <li><Link href="/proyecto" className="transition-colors hover:text-white">Visión y reglas</Link></li>
            </ul>
          </nav>

          <nav aria-label="Transparencia y acceso">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-300">Transparencia</p>
            <ul className="mt-4 space-y-3 text-sm text-emerald-50/80">
              <li><Link href="/privacidad" className="transition-colors hover:text-white">Datos y privacidad</Link></li>
              <li><Link href={conMunicipalidad('/metodologia#correcciones', slug)} className="transition-colors hover:text-white">Solicitar corrección</Link></li>
              <li><Link href="/admin" className="inline-flex items-center gap-1.5 transition-colors hover:text-white">Administración <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></Link></li>
            </ul>
          </nav>

          <Link href={conMunicipalidad('/metodologia#correcciones', slug)} className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-2.5 text-sm font-semibold text-emerald-50 transition-colors hover:border-emerald-300/50 hover:bg-emerald-400/15">
            <Mail aria-hidden="true" className="h-4 w-4 text-emerald-300" />
            Reportar un dato para revisión
          </Link>
        </div>
      </div>

      <div className="relative border-t border-white/10 bg-black/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-center text-[11px] text-emerald-100/65 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:text-left">
          <p>© 2026 Fiscalizador. Todos los derechos reservados.</p>
          <p>Iniciativa ciudadana independiente · Selva Central, Perú</p>
        </div>
      </div>
    </footer>
  );
}
