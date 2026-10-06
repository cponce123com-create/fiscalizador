import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { cerrarSesion } from '@/app/admin/actions';
import { NavPrincipal } from '@/components/admin/nav-principal';
import { Boton } from '@/components/ui/button';
import { permisosDe } from '@/lib/auth/permissions';
import { usuarioActual } from '@/lib/auth/session';
import { exigeSegundoFactor } from '@/services/twoFactorService';

/**
 * Layout del panel autenticado.
 *
 * Vive en el grupo `(panel)`, que no cambia la URL: `app/admin/(panel)/page.tsx`
 * sigue sirviendo `/admin`. El grupo existe para que el formulario de acceso
 * (`app/admin/login`) quede FUERA de este layout y no se produzca un bucle de
 * redirecciones.
 */
export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioActual();

  // El middleware ya filtra, pero solo comprueba la firma del token. Aquí se
  // revalida contra la base de datos: una cuenta desactivada debe quedarse
  // fuera aunque su token siga siendo válido.
  if (!usuario) redirect('/admin/login');

  // Cambio de contraseña obligatorio. Va antes que el segundo factor: mientras la
  // contraseña siga siendo la que se compartió al crear la cuenta, lo urgente es esa, y el
  // alta del 2FA se hace después. La página vive fuera de este layout, igual que la del
  // 2FA, para que no se produzca un bucle de redirecciones.
  if (usuario.mustChangePassword) {
    redirect('/admin/cambiar-contrasena');
  }

  // Segundo factor obligatorio para las cuentas administrativas: hasta que no lo activen
  // no pasan de aquí. El alta vive en `/admin/2fa`, fuera de este layout, para que no se
  // produzca un bucle de redirecciones.
  if (exigeSegundoFactor(usuario.role) && !usuario.twoFactorEnabled) {
    redirect('/admin/2fa');
  }

  const permisos = permisosDe(usuario.role);

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/admin" className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
              <span className="text-sm font-semibold">Portal de Transparencia</span>
            </Link>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium leading-tight">{usuario.name ?? usuario.email}</p>
                <p className="text-xs text-muted-foreground">{usuario.role}</p>
              </div>

              <form action={cerrarSesion}>
                <Boton type="submit" variant="outline" size="sm">
                  Cerrar sesión
                </Boton>
              </form>
            </div>
          </div>

          <NavPrincipal permisos={permisos} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
