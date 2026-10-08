'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

export function PeriodoRanking({ periodos, seleccionado }: { periodos: { id: string; nombre: string }[]; seleccionado: string }) {
  const router = useRouter();
  const ruta = usePathname();
  const parametros = useSearchParams();
  const [pendiente, transicion] = useTransition();

  return <div className="flex flex-col gap-2" aria-busy={pendiente}>
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      Periodo de gestión municipal
      <select value={seleccionado} disabled={pendiente} className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" onChange={evento => {
        const query = new URLSearchParams(parametros.toString());
        query.set('gestion', evento.target.value);
        query.delete('pagina');
        transicion(() => router.replace(`${ruta}?${query.toString()}`, { scroll: false }));
      }}>
        {periodos.map((periodo, indice) => <option key={periodo.id} value={periodo.id}>{periodo.nombre}{indice === 0 ? ' · más reciente con datos' : ''}</option>)}
        <option value="todas">Todos los periodos</option>
      </select>
    </label>
    <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{pendiente ? 'Actualizando ranking…' : 'Los montos y porcentajes corresponden a la gestión y al tipo de RUC seleccionados.'}</p>
  </div>;
}
