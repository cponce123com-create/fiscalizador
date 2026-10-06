import type { DefaultSession } from 'next-auth';

import type { Role } from '@/lib/auth/permissions';

/**
 * Ampliación de los tipos de Auth.js para incluir el rol.
 *
 * Sin esto, `session.user.role` y `token.role` no existirían para TypeScript y
 * acabaríamos sembrando castings por todo el panel de administración.
 *
 * DETALLE IMPORTANTE: la interfaz `JWT` NO se declara en `next-auth/jwt`.
 * Ese módulo solo hace `export * from "@auth/core/jwt"`, así que augmentarlo
 * crearía una interfaz nueva en lugar de fusionarla con la original, y `token.id`
 * seguiría siendo `unknown` (porque `JWT extends Record<string, unknown>`).
 * El destino correcto es `@auth/core/jwt`.
 */

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: Role;
      sessionVersion?: number;
    } & DefaultSession['user'];
  }

  interface User {
    role: Role;
    sessionVersion?: number;
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role: Role;
    sessionVersion?: number;
  }
}
