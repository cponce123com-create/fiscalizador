'use server';

import { z } from 'zod';

import { ErrorDeNegocio } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { usuarioActual } from '@/lib/auth/session';
import { registrarAuditoria } from '@/services/auditService';
import { activar } from '@/services/twoFactorService';

/**
 * Alta de la verificación en dos pasos.
 *
 * El secreto viaja en el formulario (oculto) porque la página que lo genera es
 * *stateless*: así no se guarda en la base un secreto que nadie ha demostrado haber
 * instalado. No es un riesgo: es el secreto del propio usuario, que ya está viendo en el
 * QR y en pantalla.
 */

const esquema = z.object({
  secreto: z.string().trim().min(16).max(64),
  codigo: z.string().trim().min(1, 'Escribe el código que muestra la aplicación.'),
});

export type Estado2fa = {
  error: string | null;
  /** Códigos de recuperación. Se enseñan UNA vez, al terminar el alta. */
  codigos: string[] | null;
};

export async function activarSegundoFactor(
  _estadoAnterior: Estado2fa,
  formData: FormData,
): Promise<Estado2fa> {
  const usuario = await usuarioActual();
  if (!usuario) {
    return { error: 'La sesión ha caducado. Vuelve a entrar.', codigos: null };
  }

  const parsed = esquema.safeParse({
    secreto: formData.get('secreto'),
    codigo: formData.get('codigo'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos incompletos.', codigos: null };
  }

  try {
    const codigos = await activar(prisma, usuario.id, parsed.data.secreto, parsed.data.codigo);

    await registrarAuditoria(prisma, {
      userId: usuario.id,
      action: 'CHANGE_SETTINGS',
      entity: 'User',
      entityId: usuario.id,
      metadata: { cambio: 'alta de verificación en dos pasos' },
    });

    return { error: null, codigos };
  } catch (error) {
    if (error instanceof ErrorDeNegocio) {
      return { error: error.message, codigos: null };
    }
    throw error;
  }
}
