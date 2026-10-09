'use client';

import { useEffect, useState } from 'react';
import { Check, SlidersHorizontal, X } from 'lucide-react';
import { hayFiltrosActivos, type Filtros } from '@/lib/filtros';

export function FiltrosFlotante({
  filtros,
  totalResultados,
  children,
}: {
  filtros: Filtros;
  totalResultados: number;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const activos = hayFiltrosActivos(filtros);

  useEffect(() => {
    if (!abierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previo;
    };
  }, [abierto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg md:hidden"
        aria-label="Abrir filtros"
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        Filtros
        {activos ? <span className="rounded-full bg-white/20 px-1.5 text-[10px]">activos</span> : null}
      </button>
      {abierto ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-labelledby="filtros-movil-titulo">
          <button type="button" className="absolute inset-0 h-full w-full cursor-default bg-black/45" aria-label="Cerrar filtros" onClick={() => setAbierto(false)} />
          <section className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl border border-border bg-background p-4 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 id="filtros-movil-titulo" className="font-semibold">Filtrar resultados</h2>
                <p className="text-xs text-muted-foreground">{totalResultados.toLocaleString('es-PE')} resultados con la selección actual.</p>
              </div>
              <button type="button" className="rounded-lg p-2 text-muted-foreground" onClick={() => setAbierto(false)} aria-label="Cerrar filtros">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            {children}
            <button type="button" className="mt-3 w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground" onClick={() => setAbierto(false)}>
              <Check size={16} aria-hidden="true" />
              Ver resultados
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}
