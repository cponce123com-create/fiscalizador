'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';

import { cambiarMiPassword, type EstadoCambioPassword } from '@/app/admin/cambiar-contrasena/actions';
import { Boton } from '@/components/ui/button';
import { Campo, Etiqueta } from '@/components/ui/form';

const INICIAL: EstadoCambioPassword = { error: null, hecho: false };

/**
 * Formulario de cambio de contraseña.
 *
 * Al terminar, pide iniciar sesión con la contraseña nueva: las sesiones anteriores
 * quedan revocadas, incluida la que hizo el cambio.
 */
export function FormularioCambioPassword({ obligatorio }: { obligatorio: boolean }) {
  const [estado, accion, pendiente] = useActionState(cambiarMiPassword, INICIAL);
  const router = useRouter();

  useEffect(() => {
    if (!estado.hecho) return;
    router.push('/admin/login');
    // Sin esto, el panel podría servirse desde la caché del router y no ver la marca ya
    // levantada, devolviendo a esta misma página.
    router.refresh();
  }, [estado.hecho, router]);

  return (
    <form action={accion} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Etiqueta htmlFor="actual">Contraseña actual</Etiqueta>
        <Campo
          id="actual"
          name="actual"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Etiqueta htmlFor="nueva">Contraseña nueva</Etiqueta>
        <Campo
          id="nueva"
          name="nueva"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
        />
        <p className="text-xs text-muted-foreground">Al menos 12 caracteres.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Etiqueta htmlFor="repetida">Repite la contraseña nueva</Etiqueta>
        <Campo
          id="repetida"
          name="repetida"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
        />
      </div>

      {estado.error ? (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      ) : null}

      <Boton type="submit" disabled={pendiente}>
        {pendiente ? 'Cambiando…' : 'Cambiar la contraseña'}
      </Boton>

      {obligatorio ? (
        <p className="text-xs text-muted-foreground">
          Mientras no la cambies no podrás usar el panel.
        </p>
      ) : null}
    </form>
  );
}
