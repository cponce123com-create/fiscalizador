'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import type { MunicipalidadActiva } from '@/lib/municipalidad';

export function SelectorMunicipalidad({ municipalidades }: { municipalidades: MunicipalidadActiva[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const seleccionada = searchParams.get('municipalidad') ?? 'san-ramon';
  const [seleccionVisual, setSeleccionVisual] = useState(seleccionada);
  const [cambiando, iniciarCambio] = useTransition();

  useEffect(() => setSeleccionVisual(seleccionada), [seleccionada]);

  const destino = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug === 'san-ramon') params.delete('municipalidad');
    else params.set('municipalidad', slug);
    params.delete('pagina');
    params.delete('page');
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const precargarRecientes = () => {
    try {
      const recientes = JSON.parse(localStorage.getItem('municipalidades-recientes') ?? '[]') as string[];
      recientes.filter(slug => slug !== seleccionada).slice(0, 2).forEach(slug => router.prefetch(destino(slug)));
    } catch { /* El historial es solo una optimización opcional. */ }
  };

  return (
    <label className="flex min-w-[13rem] flex-col gap-1 text-xs font-medium text-muted-foreground">
      Municipalidad
      <select
        value={seleccionVisual}
        disabled={cambiando}
        aria-busy={cambiando}
        onPointerDown={precargarRecientes}
        onFocus={precargarRecientes}
        onChange={(event) => {
          const slug = event.target.value;
          setSeleccionVisual(slug);
          const url = destino(slug);
          try {
            const anteriores = JSON.parse(localStorage.getItem('municipalidades-recientes') ?? '[]') as string[];
            localStorage.setItem('municipalidades-recientes', JSON.stringify([slug, ...anteriores.filter(item => item !== slug)].slice(0, 4)));
          } catch { /* La navegación funciona aunque el almacenamiento esté bloqueado. */ }
          router.prefetch(url);
          iniciarCambio(() => router.push(url));
        }}
        className="h-11 rounded-lg border border-control bg-background px-3 text-sm font-semibold text-foreground shadow-sm disabled:cursor-wait disabled:opacity-70"
      >
        {municipalidades.map((municipalidad) => (
          <option key={municipalidad.id} value={municipalidad.slug}>
            {municipalidad.nombreCorto}
          </option>
        ))}
      </select>
      <span className="min-h-4 text-[10px] font-normal text-muted-foreground" aria-live="polite">{cambiando ? 'Cambiando municipalidad…' : 'Cambio rápido por entidad'}</span>
    </label>
  );
}
