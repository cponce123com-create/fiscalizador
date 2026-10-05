'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useActionState } from 'react';

import { Boton } from '@/components/ui/button';
import { Aviso } from '@/components/ui/data';
import { cn } from '@/lib/utils';

/**
 * Envoltorio de formulario para las acciones del panel.
 *
 * Los formularios de personas y etiquetas comparten forma: reciben datos, pueden
 * fallar por una regla de negocio y, si salen bien, la lista se refresca sola
 * (`revalidatePath` en el Server Action). En lugar de repetir el mismo
 * `useActionState` en cada formulario, se escribe una vez aquí.
 *
 * Es un componente de cliente porque `useActionState` lo es; los campos que recibe
 * como `children` se siguen renderizando en el servidor.
 */

export type EstadoFormulario = { error: string | null; ok: string | null };

const ESTADO_INICIAL: EstadoFormulario = { error: null, ok: null };

export function FormularioAccion({
  accion,
  etiqueta,
  children,
  variante = 'primary',
  size = 'md',
  className,
  confirmar,
}: {
  accion: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  /** Texto del botón de envío. */
  etiqueta: string;
  children: React.ReactNode;
  variante?: 'primary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Si se indica, pide confirmación antes de enviar (para borrar, sobre todo). */
  confirmar?: string;
}) {
  const [estado, enviar, enviando] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form
      action={enviar}
      className={cn('flex flex-col gap-4', className)}
      onSubmit={(evento) => {
        if (confirmar && !window.confirm(confirmar)) evento.preventDefault();
      }}
    >
      {estado.error ? (
        <Aviso
          tono="error"
          titulo="No se pudo guardar"
          icono={<AlertTriangle className="h-4 w-4" />}
        >
          {estado.error}
        </Aviso>
      ) : null}

      {estado.ok ? (
        <Aviso tono="exito" titulo={estado.ok} icono={<CheckCircle2 className="h-4 w-4" />} />
      ) : null}

      {children}

      <div>
        <Boton type="submit" variant={variante} size={size} disabled={enviando}>
          {enviando ? 'Guardando…' : etiqueta}
        </Boton>
      </div>
    </form>
  );
}
