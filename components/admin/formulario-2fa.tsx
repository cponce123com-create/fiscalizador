'use client';

import { KeyRound } from 'lucide-react';
import Link from 'next/link';
import { useActionState } from 'react';

import { activarSegundoFactor, type Estado2fa } from '@/app/admin/2fa/actions';
import { Boton } from '@/components/ui/button';
import { Aviso } from '@/components/ui/data';
import { Campo, GrupoCampo } from '@/components/ui/form';

const ESTADO_INICIAL: Estado2fa = { error: null, codigos: null };

/**
 * Formulario de alta del segundo factor.
 *
 * Después de activarlo, sustituye el formulario por los códigos de recuperación: es la
 * única vez que se pueden ver, así que la pantalla se queda ahí hasta que el usuario
 * decide continuar.
 */
export function Formulario2fa({ secreto }: { secreto: string }) {
  const [estado, accion, enviando] = useActionState(activarSegundoFactor, ESTADO_INICIAL);

  if (estado.codigos) {
    return (
      <div className="flex flex-col gap-4">
        <Aviso tono="exito" titulo="Verificación en dos pasos activada">
          Guarda estos códigos en un sitio seguro. <strong>No se vuelven a mostrar</strong> y cada
          uno sirve una sola vez: son la salida si pierdes el teléfono.
        </Aviso>

        <ul className="grid gap-2 sm:grid-cols-2">
          {estado.codigos.map((codigo) => (
            <li
              key={codigo}
              className="rounded-md border border-border bg-muted px-3 py-2 text-center font-mono text-sm tracking-wider"
            >
              {codigo}
            </li>
          ))}
        </ul>

        <Link
          href="/admin"
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Continuar al panel
        </Link>
      </div>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="secreto" value={secreto} />

      {estado.error ? (
        <Aviso tono="error" titulo="No se pudo activar">
          {estado.error}
        </Aviso>
      ) : null}

      <GrupoCampo
        etiqueta="Código de la aplicación"
        htmlFor="codigo"
        obligatorio
        ayuda="Seis dígitos. Cambia cada 30 segundos."
      >
        <Campo
          id="codigo"
          name="codigo"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          placeholder="123456"
        />
      </GrupoCampo>

      <Boton type="submit" disabled={enviando} className="self-start">
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        {enviando ? 'Comprobando…' : 'Activar'}
      </Boton>
    </form>
  );
}
