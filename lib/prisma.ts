import { PrismaPg } from '@prisma/adapter-pg';

import { env } from '@/lib/env';
import { PrismaClient } from '@/lib/generated/prisma/client';

/**
 * Cliente Prisma con driver adapter de PostgreSQL.
 *
 * Prisma 7 eliminó la propiedad `url` del bloque `datasource`: la conexión del
 * runtime se inyecta aquí mediante `PrismaPg`, usando DATABASE_URL (host con
 * pooling de Neon). Las migraciones usan DIRECT_URL desde `prisma.config.ts`.
 */
function crearCliente(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

/**
 * En desarrollo Next.js recompila y reevalúa los módulos en cada cambio. Sin un
 * singleton, cada recarga crearía un pool nuevo hasta agotar las conexiones de
 * Neon.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? crearCliente();

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
