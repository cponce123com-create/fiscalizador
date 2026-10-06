import { redirect } from 'next/navigation';

import { FormularioCambioPassword } from '@/components/admin/formulario-cambio-password';
import { usuarioActual } from '@/lib/auth/session';

/**
 * Cambio de la contraseña propia.
 *
 * Vive fuera del grupo `(panel)`, como el alta de 2FA, porque el layout del panel manda
 * aquí a quien tenga la marca `mustChangePassword`: si esta página estuviera dentro del
 * layout, la redirección sería circular.
 */
export default async function PaginaCambioPassword() {
  const usuario = await usuarioActual();
  if (!usuario) redirect('/admin/login');

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Cambiar la contraseña</h1>

        {usuario.mustChangePassword ? (
          <p className="text-sm text-muted-foreground">
            La contraseña de esta cuenta la conoce alguien más que tú: se usó para crearla o
            para restablecerla. Cámbiala para poder entrar al panel.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Puedes cambiar tu contraseña cuando quieras. Se te pedirá la actual.
          </p>
        )}
      </div>

      <FormularioCambioPassword obligatorio={usuario.mustChangePassword} />
    </div>
  );
}
