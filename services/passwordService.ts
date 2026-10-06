import type { PrismaClient } from '@/lib/generated/prisma/client';
import { ErrorDeNegocio } from '@/lib/errors';
import { hashearPassword, validarFortaleza, verificarPassword } from '@/lib/auth/passwords';

/**
 * Cambio de la contraseña de la propia cuenta.
 *
 * Existe porque hay cuentas cuya contraseña la conoce alguien más que su dueño: la del
 * seed viaja en claro en una variable de entorno, y las que resetea un administrador las
 * teclea él. En los dos casos la cuenta queda marcada con `mustChangePassword`, y el panel
 * no se abre hasta que se cambie.
 *
 * Se exige la contraseña ACTUAL aunque la sesión ya esté abierta. Es lo que impide que
 * alguien que encuentre una sesión olvidada en un navegador se apropie de la cuenta
 * cambiándole la contraseña.
 */

export async function cambiarPassword(
  prisma: PrismaClient,
  entrada: { userId: string; actual: string; nueva: string },
): Promise<void> {
  const usuario = await prisma.user.findUnique({
    where: { id: entrada.userId },
    select: { id: true, passwordHash: true },
  });

  if (!usuario) {
    throw new ErrorDeNegocio('La cuenta no existe.');
  }

  // Las cuentas creadas con un proveedor externo no tienen contraseña. Sin esto,
  // `verificarPassword` recibiría un null y el error sería un 500 sin explicación.
  if (!usuario.passwordHash) {
    throw new ErrorDeNegocio(
      'Esta cuenta no tiene contraseña: entra con tu proveedor y cámbiala allí.',
    );
  }

  if (!(await verificarPassword(usuario.passwordHash, entrada.actual))) {
    throw new ErrorDeNegocio('La contraseña actual no es correcta.');
  }

  const fortaleza = validarFortaleza(entrada.nueva);
  if (!fortaleza.ok) {
    throw new ErrorDeNegocio(fortaleza.motivo);
  }

  // Repetir la misma contraseña dejaría la cuenta con la credencial que se compartió en
  // claro, que es justo lo que se quiere evitar al exigir el cambio.
  if (await verificarPassword(usuario.passwordHash, entrada.nueva)) {
    throw new ErrorDeNegocio('La contraseña nueva tiene que ser distinta de la actual.');
  }

  await prisma.user.update({
    where: { id: usuario.id },
    data: {
      passwordHash: await hashearPassword(entrada.nueva),
      // Es el único sitio que levanta la marca. Si se olvidara, la cuenta quedaría
      // encerrada fuera del panel para siempre.
      mustChangePassword: false,
      sessionVersion: { increment: 1 },
    },
  });
}
