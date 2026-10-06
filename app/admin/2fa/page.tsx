import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import * as QRCode from 'qrcode';

import { Formulario2fa } from '@/components/admin/formulario-2fa';
import { usuarioActual } from '@/lib/auth/session';
import { exigeSegundoFactor, iniciarAlta } from '@/services/twoFactorService';

/**
 * Alta de la verificación en dos pasos.
 *
 * Vive **fuera** del grupo `(panel)` a propósito: el layout del panel redirige aquí a
 * quien no la tenga activada, así que si esta página estuviera dentro, se redirigiría a sí
 * misma en bucle.
 *
 * Se renderiza en cada petición (`force-dynamic`): el secreto es nuevo cada vez, y no debe
 * quedar en ninguna caché.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Verificación en dos pasos',
  robots: { index: false, follow: false },
};

export default async function PaginaAlta2fa() {
  const usuario = await usuarioActual();
  if (!usuario) redirect('/admin/login');
  if (usuario.mustChangePassword) redirect('/admin/cambiar-contrasena');
  // Si ya la tiene activada, aquí no pinta nada.
  if (usuario.twoFactorEnabled) redirect('/admin');

  const obligatorio = exigeSegundoFactor(usuario.role);
  const { secreto, url } = iniciarAlta(usuario.email);
  // El QR se genera como PNG en `data:` URL, así que se pinta con un `img` normal: no
  // hace falta inyectar HTML ni añadir una librería de componentes.
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 240 });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
        <h1 className="text-xl font-semibold">Verificación en dos pasos</h1>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        {obligatorio
          ? 'Tu cuenta administra el portal, así que la verificación en dos pasos es obligatoria: hasta que la actives no puedes usar el panel.'
          : 'Añade una segunda comprobación al iniciar sesión. Para tu rol es opcional, pero recomendable.'}
      </p>

      <ol className="mt-6 flex list-decimal flex-col gap-1.5 pl-5 text-sm">
        <li>Instala una aplicación de autenticación (Google Authenticator, Aegis, 1Password…).</li>
        <li>Escanea el código QR o introduce la clave a mano.</li>
        <li>Escribe abajo el código de seis dígitos que mostrará la aplicación.</li>
      </ol>

      <div className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- es un PNG en data: URL, no una imagen remota que Next pueda optimizar */}
        <img
          src={qr}
          alt="Código QR para configurar la verificación en dos pasos"
          width={240}
          height={240}
        />
        <p className="text-xs text-muted-foreground">Si no puedes escanearlo, introduce esta clave:</p>
        <code className="rounded-md bg-muted px-3 py-1.5 font-mono text-sm tracking-widest">
          {secreto}
        </code>
      </div>

      <div className="mt-6">
        <Formulario2fa secreto={secreto} />
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        <Link href="/admin" className="underline underline-offset-2 hover:text-foreground">
          Volver al panel
        </Link>
      </p>
    </div>
  );
}
