'use server';

import { signOut } from '@/auth';

/**
 * Cierra la sesión y vuelve al formulario de acceso.
 *
 * `signOut` lanza la redirección de Next.js de forma interna, así que no se
 * captura: dejarla propagar es lo que hace que el navegador acabe en el login.
 */
export async function cerrarSesion(): Promise<void> {
  await signOut({ redirectTo: '/admin/login' });
}
