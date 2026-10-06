'use server';

import { AuthError } from 'next-auth';
import { z } from 'zod';

import { signIn } from '@/auth';

/**
 * Inicio de sesión con credenciales.
 *
 * Detalle crítico: cuando las credenciales son válidas, `signIn` no "devuelve":
 * lanza internamente la redirección de Next.js. Esa excepción NO es un
 * `AuthError` y debe propagarse tal cual. Capturarla y convertirla en un mensaje
 * de error haría que un inicio de sesión correcto pareciera fallido.
 */

const esquema = z.object({
  email: z.string().email('Escribe un correo válido.'),
  password: z.string().min(1, 'Escribe tu contraseña.'),
  /** Código TOTP o de recuperación. Vacío en las cuentas sin 2FA. */
  codigo: z.string().trim().optional(),
});

export type EstadoLogin = { error: string | null };

export async function iniciarSesion(
  _estadoAnterior: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const parsed = esquema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    codigo: formData.get('codigo') ?? '',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos incompletos.' };
  }

  // Solo se aceptan rutas internas del panel: si alguien manipula el parámetro
  // para apuntar a otro sitio, se ignora. Evita una redirección abierta.
  const destino = formData.get('callbackUrl');
  const callbackUrl =
    typeof destino === 'string' && destino.startsWith('/admin') ? destino : '/admin';

  try {
    await signIn('credentials', {
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
      codigo: parsed.data.codigo ?? '',
      redirectTo: callbackUrl,
    });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      // Mensaje deliberadamente genérico: no se revela si el correo existe.
      return { error: 'Correo o contraseña incorrectos.' };
    }
    throw error;
  }
}
