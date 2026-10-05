'use client';

import { Upload } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';

import { cn } from '@/lib/utils';

/**
 * Zona para soltar libros.
 *
 * Acepta arrastre y clic: el arrastre es lo cómodo cuando se suben doce libros de
 * golpe, pero el botón «Elegir archivos» es lo que hace que funcione con teclado y
 * en cualquier navegador. La zona no valida ni procesa nada: solo entrega los
 * archivos a quien la usa.
 */
export function ZonaDeCarga({
  onArchivos,
  deshabilitada = false,
  maxArchivos,
  etiqueta = 'Arrastra los libros aquí',
}: {
  onArchivos: (archivos: File[]) => void;
  deshabilitada?: boolean;
  maxArchivos: number;
  etiqueta?: string;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);

  function alSoltar(evento: DragEvent<HTMLDivElement>) {
    evento.preventDefault();
    setArrastrando(false);
    if (deshabilitada) return;

    const archivos = Array.from(evento.dataTransfer?.files ?? []);
    if (archivos.length > 0) onArchivos(archivos);
  }

  function alElegir(evento: ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(evento.target.files ?? []);
    if (archivos.length > 0) onArchivos(archivos);
    // Permite volver a elegir el mismo archivo después de quitarlo de la cola.
    evento.target.value = '';
  }

  return (
    <div
      onDragOver={(evento) => {
        evento.preventDefault();
        if (!deshabilitada) setArrastrando(true);
      }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={alSoltar}
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
        arrastrando ? 'border-primary bg-primary/5' : 'border-border bg-card',
        deshabilitada && 'opacity-60',
      )}
    >
      <span
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full',
          arrastrando ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
        )}
        aria-hidden="true"
      >
        <Upload className="h-5 w-5" />
      </span>

      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{etiqueta}</p>
        <p className="text-xs text-muted-foreground">
          o selecciónalos con el botón. Se admiten .xls, .xlsx y .csv.
        </p>
      </div>

      <button
        type="button"
        onClick={() => entrada.current?.click()}
        disabled={deshabilitada}
        className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
      >
        Elegir archivos
      </button>

      <input
        ref={entrada}
        type="file"
        multiple
        accept=".xls,.xlsx,.csv"
        className="sr-only"
        onChange={alElegir}
        tabIndex={-1}
      />

      <p className="text-xs text-muted-foreground">
        Hasta {maxArchivos} archivos de 25 MB cada uno. El periodo de cada libro se deduce de sus
        fechas de emisión y puedes corregirlo antes de analizar.
      </p>
    </div>
  );
}
