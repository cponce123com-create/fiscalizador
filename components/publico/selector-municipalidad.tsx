'use client';

import { useOptimistic, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import type { MunicipalidadActiva } from '@/lib/municipalidad';
import { nombreCategoriaEntidadPublica } from '@/lib/entidad-publica';

export function SelectorMunicipalidad({ municipalidades }: { municipalidades: MunicipalidadActiva[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const seleccionada = searchParams.get('municipalidad') ?? 'san-ramon';
  const [seleccionOptimista, setSeleccionOptimista] = useOptimistic(seleccionada);
  const [cambiando, iniciarCambio] = useTransition();

  const destino = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug === 'san-ramon') params.delete('municipalidad');
    else params.set('municipalidad', slug);
    params.delete('pagina');
    params.delete('page');
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  return (
    <label className="flex w-full min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground sm:w-auto sm:min-w-[13rem]">
      Entidad pública
      <select
        value={seleccionOptimista}
        disabled={cambiando}
        aria-busy={cambiando}
        onChange={(event) => {
          const slug = event.target.value;
          const url = destino(slug);
          iniciarCambio(() => {
            setSeleccionOptimista(slug);
            router.push(url);
          });
        }}
        className="h-11 w-full rounded-lg border border-control bg-background px-3 text-sm font-semibold text-foreground shadow-sm disabled:cursor-wait disabled:opacity-70"
      >
        {municipalidades.map((municipalidad) => (
          <option key={municipalidad.id} value={municipalidad.slug}>
            {municipalidad.nombreCorto} · {nombreCategoriaEntidadPublica(municipalidad.categoria ?? 'MUNICIPALIDAD')}
          </option>
        ))}
      </select>
      <span className="min-h-4 text-[10px] font-normal text-muted-foreground" aria-live="polite">{cambiando ? 'Cambiando municipalidad…' : 'Cambio rápido por entidad'}</span>
      {cambiando ? <span className="fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-emerald-100" role="progressbar" aria-label="Cambiando municipalidad"><span className="block h-full w-2/3 animate-pulse rounded-r-full bg-primary" /></span> : null}
    </label>
  );
}
