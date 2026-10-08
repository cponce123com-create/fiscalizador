/**
 * Arranque del servidor.
 *
 * Next.js ejecuta `register()` una vez al iniciar el servidor, antes de atender
 * peticiones. Se aprovecha para despertar la base de datos (Neon suspende el cómputo
 * por inactividad), de modo que el coste del arranque en frío no lo pague la primera
 * visita real.
 *
 * No se espera al despertar: si la base estuviera caída, bloquear aquí retrasaría el
 * arranque —y con él el chequeo de salud del despliegue— sin ganar nada. El despertar
 * reintenta por su cuenta y, si no lo logra, cada petición vuelve a intentarlo.
 */
export async function register(): Promise<void> {
  // `register` también corre en el runtime Edge (el middleware), donde Prisma y `pg`
  // no existen: sin este guard, el arranque fallaría.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { validarAlmacenamientoConfigurado } = await import('@/services/storageService');
  await validarAlmacenamientoConfigurado();

  const { despertarBaseDeDatos } = await import('@/lib/prisma');
  void despertarBaseDeDatos();
}
