import type { ClienteDb } from '@/services/auditService';

/**
 * Límite de intentos de inicio de sesión.
 *
 * El contador vive en PostgreSQL y no en la memoria del proceso: Render reinicia
 * el servicio y puede tener varias instancias, así que un bloqueo en memoria se
 * perdería al primer reinicio y no se compartiría entre instancias.
 *
 * Se limita por correo (normalizado a minúsculas) y por IP. La IP se toma de
 * `X-Forwarded-For`, tal como la deja el proxy de Render: es **orientativa** y no
 * debe presentarse como infalsificable, pero basta para frenar un ataque en curso.
 */

/** Fallos dentro de la ventana que disparan el bloqueo. */
export const MAX_FALLOS = 5;

/** Duración de la ventana de conteo, en milisegundos (15 minutos). */
export const VENTANA_MS = 15 * 60 * 1000;

/** Duración del bloqueo, en milisegundos (15 minutos). */
export const BLOQUEO_MS = 15 * 60 * 1000;

export type Ambito = 'EMAIL' | 'IP';

export type ClavesLogin = {
  /** Correo ya normalizado a minúsculas. */
  email: string;
  /** IP del cliente, o `null` si no se pudo determinar. */
  ip: string | null;
};

/**
 * Claves efectivas a limitar.
 *
 * Una IP ausente se omite en lugar de agruparse bajo un falso `"null"`: si no se
 * pudo determinar, limitar por correo es lo único honesto que se puede hacer.
 */
function clavesDe({ email, ip }: ClavesLogin): Array<{ scope: Ambito; key: string }> {
  const claves: Array<{ scope: Ambito; key: string }> = [{ scope: 'EMAIL', key: email }];
  if (ip) claves.push({ scope: 'IP', key: ip });
  return claves;
}

/** ¿Está bloqueada alguna de las claves (correo o IP) en este momento? */
export async function estaBloqueado(db: ClienteDb, datos: ClavesLogin): Promise<boolean> {
  const filas = await db.loginAttempt.findMany({
    where: { OR: clavesDe(datos), blockedUntil: { gt: new Date() } },
    select: { id: true },
    take: 1,
  });
  return filas.length > 0;
}

/**
 * Registra un fallo en cada clave y bloquea las que alcanzan el umbral.
 *
 * Devuelve `true` si alguna clave quedó bloqueada en esta llamada, para que quien
 * llama pueda dejarlo en la auditoría.
 */
export async function registrarFallo(db: ClienteDb, datos: ClavesLogin): Promise<boolean> {
  const ahora = new Date();
  const inicioVentana = new Date(ahora.getTime() - VENTANA_MS);
  let bloqueado = false;

  for (const clave of clavesDe(datos)) {
    // Si la ventana caducó, el conteo anterior ya no cuenta. No se limpia
    // `blockedUntil` aquí: si el bloqueo fuera más largo que la ventana, borrarlo
    // lo desactivaría antes de tiempo, y un bloqueo caducado se ignora solo.
    await db.loginAttempt.updateMany({
      where: { scope: clave.scope, key: clave.key, windowStartedAt: { lt: inicioVentana } },
      data: { count: 0, windowStartedAt: ahora },
    });

    // `increment` es atómico en la base: dos fallos simultáneos no se pisan.
    const intento = await db.loginAttempt.upsert({
      where: { scope_key: { scope: clave.scope, key: clave.key } },
      create: {
        scope: clave.scope,
        key: clave.key,
        count: 1,
        windowStartedAt: ahora,
        lastAttemptAt: ahora,
      },
      update: { count: { increment: 1 }, lastAttemptAt: ahora },
    });

    if (intento.count >= MAX_FALLOS) {
      await db.loginAttempt.update({
        where: { id: intento.id },
        data: { blockedUntil: new Date(ahora.getTime() + BLOQUEO_MS) },
      });
      bloqueado = true;
    }
  }

  return bloqueado;
}

/** Un inicio de sesión correcto limpia el contador de sus claves. */
export async function registrarExito(db: ClienteDb, datos: ClavesLogin): Promise<void> {
  await db.loginAttempt.deleteMany({ where: { OR: clavesDe(datos) } });
}
