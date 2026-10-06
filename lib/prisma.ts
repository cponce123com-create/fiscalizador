import { PrismaPg } from '@prisma/adapter-pg';

import { env } from '@/lib/env';
import { PrismaClient } from '@/lib/generated/prisma/client';
import { reintentar } from '@/lib/reintentos';

/**
 * Cliente Prisma con driver adapter de PostgreSQL.
 *
 * Prisma 7 eliminó la propiedad `url` del bloque `datasource`: la conexión del
 * runtime se inyecta aquí mediante `PrismaPg`, usando DATABASE_URL (host con
 * pooling de Neon). Las migraciones usan DIRECT_URL desde `prisma.config.ts`.
 */

/**
 * Ajustes del pool de conexiones.
 *
 * `connectionTimeoutMillis` pone un tope a la espera de una conexión. Sin él, un
 * arranque en frío de Neon —que suspende el cómputo por inactividad— podía quedarse
 * colgado hasta el timeout del sistema operativo (cerca de dos minutos) y la primera
 * petición devolvía `ETIMEDOUT`. `keepAlive` evita perder conexiones ociosas por el
 * camino, que es la otra cara del mismo problema.
 */
const OPCIONES_POOL = {
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  keepAlive: true,
  max: 5,
};

function crearCliente(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL, ...OPCIONES_POOL });

  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

/**
 * En desarrollo Next.js recompila y reevalúa los módulos en cada cambio. Sin un
 * singleton, cada recarga crearía un pool nuevo hasta agotar las conexiones de Neon.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? crearCliente();

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Despierta la base de datos.
 *
 * La llama `instrumentation.ts` al arrancar el servidor. Neon suspende el cómputo por
 * inactividad, así que la primera conexión tras un despliegue puede tardar o fallar
 * mientras despierta; hacerlo al arrancar, con unos pocos reintentos, evita que ese
 * coste lo pague la primera visita real.
 *
 * Si al final no responde, no se aborta nada: cada petición volverá a intentarlo.
 */
export async function despertarBaseDeDatos(): Promise<void> {
  try {
    await reintentar(() => prisma.$queryRaw`SELECT 1`, {
      intentos: 4,
      esperaMs: 750,
      alFallar: (error, intento) => {
        console.warn(`La base de datos no respondió en el intento ${intento}.`, error);
      },
    });
  } catch (error) {
    console.error('No se pudo despertar la base de datos al arrancar:', error);
  }
}
