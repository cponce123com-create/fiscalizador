import NextAuth from 'next-auth';

import { authConfig } from '@/auth.config';

/**
 * Middleware de protección de rutas.
 *
 * Importa SOLO `auth.config.ts`, que es seguro para el runtime Edge. Importar
 * `auth.ts` arrastraría Prisma y `pg` al bundle de Edge y rompería el build.
 *
 * El middleware decide únicamente si hay sesión firmada. Los permisos por rol se
 * comprueban en cada manejador de ruta, contra la base de datos, porque aquí no
 * se puede saber si la cuenta sigue activa ni cuál es su rol actual.
 */

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const { nextUrl } = request;
  const haySesion = Boolean(request.auth);
  const esPaginaLogin = nextUrl.pathname === '/admin/login';
  const esApiAdmin = nextUrl.pathname.startsWith('/api/admin');

  // Las rutas de API responden 401 en lugar de redirigir: una redirección a una
  // llamada fetch no aporta nada y complica el diagnóstico.
  if (esApiAdmin && !haySesion) {
    return Response.json({ error: 'No autenticado.' }, { status: 401 });
  }

  if (nextUrl.pathname.startsWith('/admin') && !esPaginaLogin && !haySesion) {
    const destino = new URL('/admin/login', nextUrl);
    // Se conserva el destino para volver a él tras iniciar sesión. Solo la ruta,
    // nunca la URL completa: así no se propaga nada más al formulario.
    destino.searchParams.set('callbackUrl', nextUrl.pathname);
    return Response.redirect(destino);
  }

  if (esPaginaLogin && haySesion) {
    return Response.redirect(new URL('/admin', nextUrl));
  }

  return undefined;
});

export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/admin/:path*'],
};
