import { handlers } from '@/auth';

/**
 * Punto de entrada de Auth.js.
 *
 * `auth.ts` consulta PostgreSQL, así que esta ruta se ejecuta en el runtime Node
 * (el valor por defecto en App Router), no en Edge.
 */
export const { GET, POST } = handlers;
