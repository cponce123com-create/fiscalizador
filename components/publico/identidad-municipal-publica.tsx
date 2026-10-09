'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import type { MunicipalidadActiva } from '@/lib/municipalidad';

type ConfigIdentidad = {
  logo: string | null;
  municipio: string;
};

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
  return `${href}${href.includes('?') ? '&' : '?'}municipalidad=${slug}`;
}

export function MarcaPublica({ config, municipalidades }: { config: ConfigIdentidad; municipalidades: MunicipalidadActiva[] }) {
  const searchParams = useSearchParams();
  const slug = searchParams.get('municipalidad');
  const municipalidad = municipalidadSeleccionada(municipalidades, slug);

  return (
    <Link href={conMunicipalidad('/', slug)} className="flex min-w-0 items-center gap-3">
      <Image
        src={config.logo || '/identidad/escudo-san-ramon.webp'}
        alt={config.logo ? `Logo del portal de ${municipalidad.nombreCorto}` : `Escudo de ${municipalidad.nombreCorto}`}
        width={52}
        height={54}
        className="h-11 w-14 shrink-0 object-contain sm:h-14 sm:w-16"
      />
      <span>
        <span className="titulo-editorial block text-lg font-bold tracking-tight text-emerald-950 sm:text-2xl">
          Fiscalizador · {municipalidad.nombreCorto}
        </span>
        <span className="text-[11px] text-muted-foreground">Vigilancia ciudadana independiente</span>
      </span>
    </Link>
  );
}

export function PiePublico({ config, municipalidades }: { config: ConfigIdentidad; municipalidades: MunicipalidadActiva[] }) {
  const searchParams = useSearchParams();
  const slug = searchParams.get('municipalidad');
  const municipalidad = municipalidadSeleccionada(municipalidades, slug);

  return (
    <footer className="mt-6 bg-emerald-950 text-white">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-2 sm:px-6">
        <div className="flex items-start gap-3">
          <Image src={config.logo || '/identidad/escudo-san-ramon.webp'} alt="" width={42} height={44} className="h-11 w-11 shrink-0 object-contain" />
          <div>
            <p className="titulo-editorial text-lg font-semibold">Fiscalizador · {municipalidad.nombreCorto}</p>
            <p className="mt-2 max-w-lg text-xs leading-relaxed text-emerald-100/80">
              Portal ciudadano independiente. Municipalidad consultada: {municipalidad.nombre}. Datos de libros mensuales publicados por la municipalidad; las órdenes no acreditan pagos.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-4 text-sm text-emerald-100">
          <Link href={conMunicipalidad('/fuentes', slug)} className="hover:underline">Fuentes y cobertura</Link>
          <Link href={conMunicipalidad('/metodologia', slug)} className="hover:underline">Metodología</Link>
          <Link href="/admin" className="hover:underline">Administración</Link>
        </div>
      </div>
    </footer>
  );
}
