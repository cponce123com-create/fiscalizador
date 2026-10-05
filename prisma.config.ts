import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Configuración de Prisma 7.
 *
 * Prisma 7 ya no lee la URL del datasource desde la CLI (`--url` fue eliminado):
 * la toma de este archivo. Por eso las migraciones usan DIRECT_URL (host sin
 * pooling), que es el único que admite sentencias DDL contra Neon.
 *
 * El runtime de la aplicación usa DATABASE_URL (host con pooling), declarado en
 * `prisma/schema.prisma` -> datasource db.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DIRECT_URL'),
  },
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
