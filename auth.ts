import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';

import { authConfig } from '@/auth.config';
import { hashearPassword, verificarPassword } from '@/lib/auth/passwords';
import type { Role } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';
import { registrarAuditoria } from '@/services/auditService';

/**
 * Configuración completa de Auth.js (solo runtime Node).
 *
 * Este archivo SÍ consulta PostgreSQL, así que nunca debe importarse desde el
 * middleware (runtime Edge). La parte compartida está en `auth.config.ts`.
 */

const credencialesSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Hash señuelo para igualar el tiempo de respuesta cuando el correo no existe.
 *
 * Sin esto, un atacante puede distinguir "usuario inexistente" de "contraseña
 * incorrecta" midiendo lo que tarda la respuesta, y así enumerar cuentas.
 */
let hashSenuelo: string | null = null;

async function obtenerHashSenuelo(): Promise<string> {
  if (!hashSenuelo) {
    hashSenuelo = await hashearPassword('senuelo-para-igualar-tiempos-de-respuesta');
  }
  return hashSenuelo;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'Credenciales',
      credentials: {
        email: { label: 'Correo', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credenciales) {
        const parsed = credencialesSchema.safeParse(credenciales);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const usuario = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            passwordHash: true,
          },
        });

        // Se verifica SIEMPRE, incluso cuando el usuario no existe, para que el
        // tiempo de respuesta no delate qué correos están registrados.
        const hash = usuario?.passwordHash ?? (await obtenerHashSenuelo());
        const passwordOk = await verificarPassword(hash, password);

        if (!usuario || !usuario.passwordHash || !passwordOk) return null;

        // Una cuenta desactivada no entra aunque la contraseña sea correcta.
        if (!usuario.isActive) return null;

        await prisma.user.update({
          where: { id: usuario.id },
          data: { lastLoginAt: new Date() },
        });

        await registrarAuditoria(prisma, {
          userId: usuario.id,
          action: 'LOGIN',
          entity: 'User',
          entityId: usuario.id,
          metadata: { email: usuario.email },
        });

        return {
          id: usuario.id,
          email: usuario.email,
          name: usuario.name,
          role: usuario.role as Role,
        };
      },
    }),
  ],
});
