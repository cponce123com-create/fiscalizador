import { createHash, randomBytes } from 'node:crypto';

import type { PrismaClient } from '@/lib/generated/prisma/client';
import { ErrorDeNegocio } from '@/lib/errors';
import { cifrar, descifrar } from '@/lib/auth/secrets';
import { generarSecreto, urlOtpAuth, verificarCodigo, pasoDeCodigo } from '@/lib/auth/totp';

/**
 * Segundo factor (TOTP) para las cuentas administrativas.
 *
 * Decisión de diseño: el secreto se guarda **cifrado** (`lib/auth/secrets.ts`) y los
 * códigos de recuperación, **hasheados**. Una copia de la base de datos no basta para
 * saltarse el 2FA.
 *
 * Los códigos de recuperación existen porque un teléfono se pierde. Sin ellos, la única
 * salida sería el procedimiento de rescate por línea de comandos, que es más lento.
 */

/** Cuántos códigos de recuperación se generan de una vez. */
export const CODIGOS_DE_RECUPERACION = 8;

/** Emisor que verán las aplicaciones de autenticación. */
const EMISOR = 'Portal de Transparencia';

/** Roles a los que se les exige el segundo factor. */
const ROLES_OBLIGADOS = new Set(['SUPERADMIN', 'ADMIN']);

/** ¿Este rol tiene que tener 2FA para usar el panel? */
export function exigeSegundoFactor(rol: string): boolean {
  return ROLES_OBLIGADOS.has(rol);
}

export type Alta = {
  /** Secreto en base32, para enseñarlo y para el QR. */
  secreto: string;
  /** URL `otpauth://` que se codifica en el QR. */
  url: string;
};

/**
 * Empieza el alta: genera un secreto y su URL. **No guarda nada**: el secreto solo se
 * persiste cuando el usuario demuestra que lo ha instalado, enviando un código válido.
 */
export function iniciarAlta(cuenta: string): Alta {
  const secreto = generarSecreto();

  return { secreto, url: urlOtpAuth({ secreto, cuenta, emisor: EMISOR }) };
}

/** ¿El código corresponde al secreto? */
export function codigoValido(secreto: string, codigo: string): boolean {
  return verificarCodigo(secreto, codigo);
}

/** Códigos de recuperación en claro. Solo se ven una vez, al terminar el alta. */
export function generarCodigosDeRecuperacion(cantidad = CODIGOS_DE_RECUPERACION): string[] {
  return Array.from({ length: cantidad }, () => {
    // 14 dígitos hexadecimales = 56 bits de entropía.
    const bruto = randomBytes(7).toString('hex').toUpperCase();
    return `${bruto.slice(0, 5)}-${bruto.slice(5, 10)}-${bruto.slice(10)}`;
  });
}

/** Normaliza un código de recuperación: sin espacios, guiones ni minúsculas. */
function normalizarCodigo(codigo: string): string {
  return codigo.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Hash de un código de recuperación. */
export function hashDeCodigo(codigo: string): string {
  return createHash('sha256').update(normalizarCodigo(codigo)).digest('hex');
}

/**
 * Confirma el alta: comprueba el código, guarda el secreto cifrado y genera los códigos de
 * recuperación. Devuelve esos códigos en claro, que **no se pueden volver a ver**.
 */
export async function activar(
  db: PrismaClient,
  usuarioId: string,
  secreto: string,
  codigo: string,
): Promise<string[]> {
  if (!verificarCodigo(secreto, codigo)) {
    throw new ErrorDeNegocio('El código no es válido o ha caducado. Vuelve a intentarlo.');
  }

  const codigos = generarCodigosDeRecuperacion();

  await db.$transaction(async (tx) => {
    // Reclamo atómico: ni un alta repetida ni dos peticiones concurrentes
    // pueden sustituir un factor ya instalado.
    const { count } = await tx.user.updateMany({
      where: { id: usuarioId, isActive: true, mustChangePassword: false, twoFactorEnabled: false },
      data: { twoFactorSecret: cifrar(secreto), lastTotpStep: null, twoFactorEnabled: true },
    });
    if (count !== 1) {
      throw new ErrorDeNegocio('No se puede activar el segundo factor: comprueba la cuenta y cambia primero la contraseña.');
    }

    // Un alta nueva invalida los códigos anteriores: si se rehace, los viejos no valen.
    await tx.twoFactorRecoveryCode.deleteMany({ where: { userId: usuarioId } });
    await tx.twoFactorRecoveryCode.createMany({
      data: codigos.map((codigoEnClaro) => ({
        userId: usuarioId,
        codeHash: hashDeCodigo(codigoEnClaro),
      })),
    });
  });

  return codigos;
}

/** Apaga el 2FA y borra los códigos. Es la salida de emergencia. */
export async function desactivar(db: PrismaClient, usuarioId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: usuarioId },
      data: { twoFactorSecret: null, lastTotpStep: null, twoFactorEnabled: false, sessionVersion: { increment: 1 } },
    });
    await tx.twoFactorRecoveryCode.deleteMany({ where: { userId: usuarioId } });
  });
}

/**
 * Gasta un código de recuperación, si existe y no se ha usado.
 *
 * El `updateMany` condicionado a `usedAt: null` es lo que garantiza que un código solo
 * sirva una vez aunque dos peticiones lleguen a la vez.
 */
async function gastarCodigoDeRecuperacion(
  db: PrismaClient,
  usuarioId: string,
  codigo: string,
): Promise<boolean> {
  const fila = await db.twoFactorRecoveryCode.findUnique({
    where: { codeHash: hashDeCodigo(codigo) },
    select: { id: true, userId: true, usedAt: true },
  });

  if (!fila || fila.userId !== usuarioId || fila.usedAt) return false;

  const { count } = await db.twoFactorRecoveryCode.updateMany({
    where: { id: fila.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  return count === 1;
}

/**
 * Comprueba el segundo factor: primero el código TOTP y, si no cuadra, un código de
 * recuperación (que se gasta).
 *
 * Devuelve `false` —sin lanzar— si el secreto guardado no se puede descifrar. Eso pasa si
 * se rotó `AUTH_SECRET` sin volver a dar de alta el 2FA, y en ese caso la cuenta debe
 * rehacer el alta; no queremos que el login reviente con un 500.
 */
export async function verificarSegundoFactor(
  db: PrismaClient,
  usuario: { id: string; twoFactorSecret: string | null },
  codigo: string,
): Promise<boolean> {
  if (!usuario.twoFactorSecret) return false;

  try {
    const paso = pasoDeCodigo(descifrar(usuario.twoFactorSecret), codigo);
    if (paso !== null) {
      const { count } = await db.user.updateMany({ where: { id: usuario.id, twoFactorEnabled: true, twoFactorSecret: usuario.twoFactorSecret, OR: [{ lastTotpStep: null }, { lastTotpStep: { lt: paso } }] }, data: { lastTotpStep: paso } });
      return count === 1;
    }
  } catch (error) {
    console.error('No se pudo descifrar el secreto 2FA; la cuenta debe rehacer el alta.', error);
    return false;
  }

  return gastarCodigoDeRecuperacion(db, usuario.id, codigo);
}
