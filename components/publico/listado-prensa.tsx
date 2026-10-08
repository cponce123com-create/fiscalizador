'use client';

import { useState } from 'react';
import type { ContratacionPrensa } from '@/lib/prensa';
import { palabrasBusqueda } from '@/lib/busqueda-ordenes';
import { TarjetaPrensa } from './tarjeta-prensa';

export function ListadoPrensa({ filas }: { filas: ContratacionPrensa[] }) {
  const [texto, setTexto] = useState('');
  const [soloConOrdenes, setSoloConOrdenes] = useState(false);
  const palabras = palabrasBusqueda(texto);
  const visibles = filas.filter(f => (!soloConOrdenes || f.ordenes > 0) && palabras.every(p => palabrasBusqueda(`${f.nombre} ${f.nombreListado} ${f.ruc}`).join(' ').includes(p)));
  return <div className="flex flex-col gap-4">
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
      <label className="flex flex-1 flex-col gap-1.5 text-sm"><span className="font-medium">Buscar en el listado</span><input type="search" value={texto} onChange={evento => setTexto(evento.target.value)} maxLength={120} placeholder="Nombre, apellido, medio o RUC" className="min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={soloConOrdenes} onChange={evento => setSoloConOrdenes(evento.target.checked)} />Solo con órdenes publicadas</label>
    </div>
    <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{visibles.length} de {filas.length} personas y medios del listado.</p>
    {visibles.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibles.map(f => <TarjetaPrensa key={f.ruc} fila={f} />)}</div> : <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No hay coincidencias con esta búsqueda.</p>}
  </div>;
}
