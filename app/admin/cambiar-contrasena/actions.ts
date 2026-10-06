'use server';

import { z } from 'zod';

import { ErrorDeNegocio } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { usuarioActual } from '@/lib/auth/session';
import { registrarAuditoria } from '@/services/auditService';
import { cambiarPassword } from '@/services/passwordService';

/**
 * Cambio de la contraseña propia.
 *
 * La página vive FUERA del layout del panel, igual que el alta de 2FA: quien está obligado
 * a cambiar la contraseña no puede entrar al panel, así que si la página estuviera dentro
 * el layout redirigiría aquí y esta página redirigiría al panel, en un bucle.
 */

const esquema = z.object({
  actual: z.string().min(1, 'Escribe tu contraseña actual.'),
  nueva: z.string().min(1, 'Escribe la contraseña nueva.'),
  repetida: z.string().min(1, 'Repite la contraseña nueva.'),
});

export type EstadoCambioPassword = {
  error: string | null;
  hecho: boolean;
};

export async function cambiarMiPassword(
  _estadoAnterior: EstadoCambioPassword,
  formData: FormData,
): Promise<EstadoCambioPassword> {
  const usuario = await usuarioActual();
  if (!usuario) {
    return { error: 'La sesión ha caducado. Vuelve a entrar.', hecho: false };
  }

  const parsed = esquema.safeParse({
    actual: formData.get('actual'),
    nueva: formData.get('nueva'),
    repetida: formData.get('repetida'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos incompletos.', hecho: false };
  }

  // Se comprueba aquí y no en el servicio: que las dos casillas coincidan es cosa del
  // formulario, no una regla del dominio.
  if (parsed.data.nueva !== parsed.data.repetida) {
    return { error: 'Las dos contraseñas nuevas no coinciden.', hecho: false };
  }

  try {
    await cambiarPassword(prisma, {
      userId: usuario.id,
      actual: parsed.data.actual,
      nueva: parsed.data.nueva,
    });

    await registrarAuditoria(prisma, {
      userId: usuario.id,
      action: 'CHANGE_SETTINGS',
      entity: 'User',
      entityId: usuario.id,
      // Ni la contraseña ni su hash: solo el hecho y de quién es la cuenta.
      metadata: { cambio: 'contraseña' },
    });

    return { error: null, hecho: true };
  } catch (error) {
    if (error instanceof ErrorDeNegocio) {
      return { error: error.message, hecho: false };
    }
    throw error;
  }
}
