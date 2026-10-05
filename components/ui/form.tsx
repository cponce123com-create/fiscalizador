import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/**
 * Controles de formulario.
 *
 * Se usan los elementos nativos (`input`, `select`, `label`) en lugar de
 * primitivos de Radix: son accesibles por defecto, no añaden dependencias y el
 * teclado y los lectores de pantalla ya los entienden.
 */

export function Etiqueta({ className, ...props }: ComponentProps<'label'>) {
  return (
    <label
      className={cn('text-sm font-medium text-foreground', className)}
      {...props}
    />
  );
}

export function Campo({
  className,
  ...props
}: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm text-foreground shadow-sm transition-colors',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'file:mr-3 file:rounded-sm file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium file:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function Selector({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm text-foreground shadow-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Envoltorio de un campo: etiqueta, control y mensajes.
 *
 * Mantener la etiqueta, la ayuda y el error en un solo componente evita que cada
 * formulario del panel invente su propia disposición y se desalineen.
 */
export function GrupoCampo({
  etiqueta,
  htmlFor,
  ayuda,
  error,
  obligatorio,
  className,
  children,
}: {
  etiqueta: string;
  htmlFor: string;
  ayuda?: string;
  error?: string;
  obligatorio?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Etiqueta htmlFor={htmlFor}>
        {etiqueta}
        {obligatorio ? <span className="ml-1 text-destructive">*</span> : null}
      </Etiqueta>

      {children}

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : ayuda ? (
        <p className="text-xs text-muted-foreground">{ayuda}</p>
      ) : null}
    </div>
  );
}

/** Interruptor accesible construido sobre un checkbox nativo. */
export function Interruptor({
  id,
  checked,
  onChange,
  etiqueta,
  nombreAccesible,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (valor: boolean) => void;
  /** Texto visible junto al control. Puede ir vacío si se usa `nombreAccesible`. */
  etiqueta: string;
  /** Nombre para lectores de pantalla cuando no hay etiqueta visible. */
  nombreAccesible?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-label={etiqueta === '' ? nombreAccesible : undefined}
        onChange={(evento) => onChange(evento.target.checked)}
        className="h-4 w-4 cursor-pointer rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
      {etiqueta ? (
        <Etiqueta htmlFor={id} className="cursor-pointer font-normal">
          {etiqueta}
        </Etiqueta>
      ) : null}
    </div>
  );
}

/** Campo de texto largo, hermano de `Campo` para descripciones y notas. */
export function AreaTexto({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'flex min-h-[6rem] w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-colors',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
