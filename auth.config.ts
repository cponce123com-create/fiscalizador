import type { NextAuthConfig } from 'next-auth';

/**
 * Configuración de Auth.js que puede ejecutarse en el runtime Edge.
 *
 * El middleware de Next.js corre en Edge y NO tiene acceso a PostgreSQL. Si el
 * middleware importara `auth.ts`, arrastraría Prisma y `pg` al bundle de Edge y
 * el build fallaría.
 *
 * Por eso la configuración se parte en dos:
 *   - este archivo: páginas, sesión y callbacks. Puro, sin base de datos.
 *   - `auth.ts`: añade el proveedor de credenciales, que sí consulta la base.
 *
 * Los callbacks de aquí solo manipulan el contenido del token, que es lo único
 * que el middleware necesita para saber si hay sesión.
 */
export const authConfig = {
  pages: {
    signIn: '/admin/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 8, // 8 horas
  },
  /**
   * Auth.js confía en el host automáticamente en desarrollo, pero en producción
   * lo rechaza con `UntrustedHost` si no se le indica lo contrario. El síntoma
   * es que el login funciona en local y devuelve "There was a problem with the
   * server configuration" al desplegar.
   *
   * Es aceptable aquí porque la aplicación solo usa el proveedor de credenciales:
   * no hay OAuth ni enlaces por correo, que son los flujos donde un host
   * manipulado permitiría redirigir a un dominio ajeno. Además, la plataforma de
   * despliegue fija el host.
   *
   * Alternativa si se prefiere decidirlo por entorno en vez de en el código:
   * definir `AUTH_TRUST_HOST=true` como variable de entorno. Se deja en `true` a
   * propósito: moverlo a una variable obligaría a definirla en Render y, si
   * faltara, el inicio de sesión de producción dejaría de funcionar sin avisar.
   */
  trustHost: true,
  // Los proveedores se añaden en `auth.ts`. El middleware no los necesita: para
  // decidir si hay sesión basta con verificar la firma del token.
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      // `user` solo viene en el inicio de sesión. El rol NO se confía a ciegas:
      // cada manejador de ruta lo revalida contra la base de datos.
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.sessionVersion = user.sessionVersion;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.sessionVersion = token.sessionVersion;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
