import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

// =============================================================================
// Tablas
// =============================================================================

export function Tabla({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border bg-card">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

export function TablaEncabezado({ className, ...props }: ComponentProps<'thead'>) {
  return <thead className={cn('bg-muted/60', className)} {...props} />;
}

export function TablaCuerpo({ className, ...props }: ComponentProps<'tbody'>) {
  return (
    <tbody
      // Filas alternas para seguir la fila con la vista en tablas anchas.
      className={cn('[&_tr:nth-child(even)]:bg-muted/25', className)}
      {...props}
    />
  );
}

export function TablaFila({ className, ...props }: ComponentProps<'tr'>) {
  return <tr className={cn('border-b border-border last:border-0', className)} {...props} />;
}

export function TablaCeldaEncabezado({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      className={cn(
        'whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function TablaCelda({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cn('px-3 py-2.5 align-top text-foreground', className)} {...props} />;
}

// =============================================================================
// Insignias
// =============================================================================

const estilosInsignia = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      tono: {
        neutro: 'border-border bg-muted text-muted-foreground',
        exito: 'border-success/30 bg-success/10 text-success',
        advertencia: 'border-warning/30 bg-warning/10 text-warning',
        error: 'border-destructive/30 bg-destructive/10 text-destructive',
        info: 'border-primary/30 bg-primary/10 text-primary',
      },
    },
    defaultVariants: { tono: 'neutro' },
  },
);

export type InsigniaProps = ComponentProps<'span'> & VariantProps<typeof estilosInsignia>;

export function Insignia({ className, tono, ...props }: InsigniaProps) {
  return <span className={cn(estilosInsignia({ tono }), className)} {...props} />;
}

// =============================================================================
// Avisos
// =============================================================================

const estilosAviso = cva('flex gap-3 rounded-lg border p-4 text-sm', {
  variants: {
    tono: {
      info: 'border-primary/30 bg-primary/5 text-foreground',
      exito: 'border-success/30 bg-success/5 text-foreground',
      advertencia: 'border-warning/40 bg-warning/10 text-foreground',
      error: 'border-destructive/40 bg-destructive/10 text-foreground',
    },
  },
  defaultVariants: { tono: 'info' },
});

export type AvisoProps = {
  tono?: 'info' | 'exito' | 'advertencia' | 'error';
  titulo?: string;
  icono?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/**
 * Aviso destacado.
 *
 * `role="status"` y `aria-live` hacen que un lector de pantalla anuncie el
 * mensaje cuando aparece, que es justo lo que hace falta tras enviar un archivo
 * o al detectar un duplicado.
 */
export function Aviso({ tono, titulo, icono, children, className }: AvisoProps) {
  return (
    <div className={cn(estilosAviso({ tono }), className)} role="status" aria-live="polite">
      {icono ? <span className="mt-0.5 shrink-0">{icono}</span> : null}
      <div className="flex flex-col gap-1">
        {titulo ? <p className="font-semibold">{titulo}</p> : null}
        {children ? <div className="text-sm text-muted-foreground">{children}</div> : null}
      </div>
    </div>
  );
}

// =============================================================================
// Estados
// =============================================================================

export function EstadoVacio({
  titulo,
  descripcion,
  icono,
  children,
}: {
  titulo: string;
  descripcion?: string;
  icono?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-14 text-center">
      {icono ? <span className="text-muted-foreground">{icono}</span> : null}
      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground">{titulo}</p>
        {descripcion ? <p className="text-sm text-muted-foreground">{descripcion}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** Indicador de carga accesible. */
export function Cargando({ etiqueta = 'Cargando…' }: { etiqueta?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-sm text-muted-foreground" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
      {etiqueta}
    </div>
  );
}

/** Bloque de carga visual que respeta lectores de pantalla y reducción de movimiento. */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-md bg-muted motion-safe:animate-pulse', className)}
      aria-hidden="true"
      {...props}
    />
  );
}
