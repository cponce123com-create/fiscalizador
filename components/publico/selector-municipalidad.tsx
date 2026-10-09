'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import type { MunicipalidadActiva } from '@/lib/municipalidad';

export function SelectorMunicipalidad({ municipalidades }: { municipalidades: MunicipalidadActiva[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const seleccionada = searchParams.get('municipalidad') ?? 'san-ramon';

  return (
    <label className="flex min-w-[13rem] flex-col gap-1 text-xs font-medium text-muted-foreground">
      Municipalidad
      <select
        value={seleccionada}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          const slug = event.target.value;
          if (slug === 'san-ramon') params.delete('municipalidad');
          else params.set('municipalidad', slug);
          params.delete('pagina');
          params.delete('page');
          const query = params.toString();
          router.push(query ? `${pathname}?${query}` : pathname);
        }}
        className="h-11 rounded-lg border border-control bg-background px-3 text-sm font-semibold text-foreground shadow-sm"
      >
        {municipalidades.map((municipalidad) => (
          <option key={municipalidad.id} value={municipalidad.slug}>
            {municipalidad.nombreCorto}
          </option>
        ))}
      </select>
    </label>
  );
}
