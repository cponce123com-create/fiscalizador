'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';

export function TooltipEducativo({
  children,
  explicacion,
}: {
  children: React.ReactNode;
  explicacion: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!abierto) return;
    function cerrar(evento: MouseEvent) {
      if (ref.current && !ref.current.contains(evento.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, [abierto]);

  return (
    <span ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setAbierto((valor) => !valor)}
        onMouseEnter={() => setAbierto(true)}
        onMouseLeave={() => setAbierto(false)}
        aria-expanded={abierto}
        aria-describedby={abierto ? id : undefined}
        className="tooltip-educativo inline-flex min-h-0 min-w-0 items-center gap-1 rounded-md border-0 bg-transparent p-0 text-inherit shadow-none underline decoration-dashed underline-offset-4 hover:bg-transparent"
      >
        {children}
        <Info size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
      {abierto ? (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-0 z-30 mb-2 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-border bg-card p-3 text-left text-xs leading-relaxed text-muted-foreground shadow-xl"
        >
          {explicacion}
        </span>
      ) : null}
    </span>
  );
}
