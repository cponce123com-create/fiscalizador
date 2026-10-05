import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

export function Tarjeta({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card text-card-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

export function TarjetaEncabezado({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 border-b border-border px-5 py-4', className)} {...props} />;
}

export function TarjetaTitulo({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('text-base font-semibold leading-tight', className)} {...props} />;
}

export function TarjetaDescripcion({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export function TarjetaContenido({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('px-5 py-4', className)} {...props} />;
}

export function TarjetaPie({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-center gap-3 border-t border-border px-5 py-3', className)}
      {...props}
    />
  );
}

/**
 * Tarjeta de cifra.
 *
 * Se usa para los indicadores del panel. `destacada` reserva el color de acento
 * para la cifra que de verdad importa (el monto considerado), de modo que la
 * vista tenga una jerarquía clara y no una rejilla de números idénticos.
 */
export function TarjetaCifra({
  etiqueta,
  valor,
  detalle,
  destacada,
  className,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
  destacada?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-5 shadow-sm',
        destacada && 'border-primary/40 ring-1 ring-primary/20',
        className,
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
      <p
        className={cn(
          'tabular mt-2 text-2xl font-semibold',
          destacada ? 'text-primary' : 'text-foreground',
        )}
      >
        {valor}
      </p>
      {detalle ? <p className="mt-1 text-xs text-muted-foreground">{detalle}</p> : null}
    </div>
  );
}
