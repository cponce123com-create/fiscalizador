-- Límite de intentos de inicio de sesión.
--
-- El contador no puede vivir en la memoria del proceso: Render reinicia el servicio y
-- puede tener varias instancias, así que un bloqueo en memoria se perdería al primer
-- reinicio y no se compartiría entre instancias. Una fila por clave —el correo
-- normalizado o la IP— con los fallos de la ventana en curso y hasta cuándo está
-- bloqueada.
CREATE TYPE "LoginAttemptScope" AS ENUM ('EMAIL', 'IP');

CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "scope" "LoginAttemptScope" NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedUntil" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoginAttempt_scope_key_key" ON "LoginAttempt"("scope", "key");
CREATE INDEX "LoginAttempt_blockedUntil_idx" ON "LoginAttempt"("blockedUntil");

-- Acciones de auditoría nuevas: fallos y bloqueos de acceso.
ALTER TYPE "AuditAction" ADD VALUE 'LOGIN_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGIN_BLOCKED';
