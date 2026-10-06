import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';

import { authConfig } from '@/auth.config';
import { hashearPassword, verificarPassword } from '@/lib/auth/passwords';
import type { Role } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';
import { contextoDePeticion, registrarAuditoria } from '@/services/auditService';
import {
  BLOQUEO_MS,
  MAX_FALLOS,
  estaBloqueado,
  registrarExito,
  registrarFallo,
} from '@/services/loginThrottleService';

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
      async authorize(credenciales, request) {
        const parsed = credencialesSchema.safeParse(credenciales);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const correo = email.toLowerCase();
        const { ip, userAgent } = contextoDePeticion(request);
        const claves = { email: correo, ip };

        const usuario = await prisma.user.findUnique({
          where: { email: correo },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            passwordHash: true,
          },
        });

        // Bloqueo activo: se responde igual que ante unas credenciales incorrectas.
        // Se verifica contra el hash señuelo para que el tiempo de respuesta no
        // delate que la cuenta (o la IP) está bloqueada.
        if (await estaBloqueado(prisma, claves)) {
          await verificarPassword(await obtenerHashSenuelo(), password);

          await registrarAuditoria(prisma, {
            action: 'LOGIN_FAILED',
            entity: 'User',
            entityId: usuario?.id ?? null,
            ip,
            userAgent,
            metadata: { email: correo, motivo: 'bloqueado' },
          });

          return null;
        }

        // Se verifica SIEMPRE, incluso cuando el usuario no existe, para que el
        // tiempo de respuesta no delate qué correos están registrados.
        const hash = usuario?.passwordHash ?? (await obtenerHashSenuelo());
        const passwordOk = await verificarPassword(hash, password);

        // Una cuenta desactivada tampoco entra: cuenta como fallo, igual que una
        // contraseña incorrecta.
        if (!usuario || !usuario.passwordHash || !passwordOk || !usuario.isActive) {
          const seBloqueo = await registrarFallo(prisma, claves);

          await registrarAuditoria(prisma, {
            action: 'LOGIN_FAILED',
            entity: 'User',
            entityId: usuario?.id ?? null,
            ip,
            userAgent,
            metadata: { email: correo },
          });

          if (seBloqueo) {
            await registrarAuditoria(prisma, {
              action: 'LOGIN_BLOCKED',
              entity: 'User',
              entityId: usuario?.id ?? null,
              ip,
              userAgent,
              metadata: {
                email: correo,
                fallos: MAX_FALLOS,
                minutosDeBloqueo: BLOQUEO_MS / 60000,
              },
            });
          }

          return null;
        }

        // Inicio correcto: se limpia el contador de fallos de sus claves.
        await registrarExito(prisma, claves);

        await prisma.user.update({
          where: { id: usuario.id },
          data: { lastLoginAt: new Date() },
        });

        await registrarAuditoria(prisma, {
          userId: usuario.id,
          action: 'LOGIN',
          entity: 'User',
          entityId: usuario.id,
          ip,
          userAgent,
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
