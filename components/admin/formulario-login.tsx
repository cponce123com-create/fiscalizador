'use client';

import { useActionState } from 'react';
import { LogIn } from 'lucide-react';

import { iniciarSesion, type EstadoLogin } from '@/app/admin/login/actions';
import { Boton } from '@/components/ui/button';
import { Aviso } from '@/components/ui/data';
import { Campo, GrupoCampo } from '@/components/ui/form';

const ESTADO_INICIAL: EstadoLogin = { error: null };

/**
 * Formulario de acceso.
 *
 * Usa `useActionState` de React 19 para recibir el resultado del Server Action
 * sin escribir estado a mano ni hacer `fetch`.
 */
export function FormularioLogin({ callbackUrl }: { callbackUrl: string }) {
  const [estado, accion, enviando] = useActionState(iniciarSesion, ESTADO_INICIAL);

  return (
    <form action={accion} className="flex flex-col gap-5">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      {estado.error ? (
        <Aviso tono="error" titulo="No se pudo iniciar sesión">
          {estado.error}
        </Aviso>
      ) : null}

      <GrupoCampo etiqueta="Correo electrónico" htmlFor="email" obligatorio>
        <Campo
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="nombre@entidad.gob.pe"
          aria-invalid={estado.error ? true : undefined}
        />
      </GrupoCampo>

      <GrupoCampo etiqueta="Contraseña" htmlFor="password" obligatorio>
        <Campo
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={estado.error ? true : undefined}
        />
      </GrupoCampo>

      <Boton type="submit" size="lg" disabled={enviando} className="w-full">
        <LogIn className="h-4 w-4" aria-hidden="true" />
        {enviando ? 'Verificando…' : 'Entrar'}
      </Boton>
    </form>
  );
}
