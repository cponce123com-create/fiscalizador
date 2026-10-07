import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

const estilos = cva(
  'inline-flex items-center justify-center gap-2 min-h-11 min-w-11 rounded-lg border border-control text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border border-control bg-card text-foreground hover:bg-muted',
        ghost: 'bg-transparent text-foreground hover:bg-muted',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        sm: 'min-h-11 px-3 py-2 text-xs',
        md: 'min-h-11 px-4 py-2 text-sm',
        lg: 'min-h-12 px-5 py-3',
        icon: 'h-11 w-11 p-2',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export type BotonProps = ComponentProps<'button'> & VariantProps<typeof estilos>;

export function Boton({ className, variant, size, ...props }: BotonProps) {
  return <button className={cn(estilos({ variant, size }), className)} {...props} />;
}
