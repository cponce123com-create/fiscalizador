import type { Prisma } from '@/lib/generated/prisma/client';

/**
 * Registro de auditoría.
 *
 * El pliego exige trazabilidad de toda acción administrativa (sección 26) y que
 * no se elimine nada crítico sin dejar rastro. Por eso `registrarAuditoria`
 * acepta un cliente de transacción: cuando la acción forma parte de una
 * operación mayor (una importación), la entrada de auditoría se escribe en la
 * MISMA transacción. Si la importación falla, no queda una auditoría mintiendo
 * sobre un trabajo que no ocurrió.
 */

/** Cliente Prisma o cliente de transacción, indistintamente. */
export type ClienteDb = Prisma.TransactionClient;

export type AuditActionValue =
  | 'LOGIN'
  | 'LOGOUT'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'IMPORT'
  | 'MERGE_SUPPLIER'
  | 'CHANGE_PHOTO'
  | 'CHANGE_COLUMN_VISIBILITY'
  | 'CHANGE_SETTINGS'
  | 'LOGIN_FAILED'
  | 'LOGIN_BLOCKED';

export type AuditInput = {
  userId?: string | null;
  action: AuditActionValue;
  /** Nombre de la entidad afectada, p. ej. "ImportBatch". */
  entity: string;
  entityId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  /** Detalle libre. Debe ser serializable a JSON. */
  metadata?: Record<string, unknown> | null;
};

/**
 * Escribe una entrada de auditoría.
 *
 * Los valores `undefined` se normalizan a `null` porque Prisma trata
 * `undefined` como "no cambies este campo", que en un `create` no es lo que
 * queremos.
 */
export async function registrarAuditoria(
  db: ClienteDb,
  input: AuditInput,
): Promise<void> {
  await db.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

/**
 * Extrae la IP y el user-agent de una petición.
 *
 * La IP es **orientativa**: sale de `X-Forwarded-For`, que el cliente puede
 * falsificar y que varias personas comparten (una oficina tras un NAT). Detrás del
 * proxy de Render el primer valor es el cliente, pero no hay que presentarla como
 * infalsificable: sirve para dejar rastro en la auditoría y para el límite de
 * intentos de acceso, nunca para decidir permisos.
 */
export function contextoDePeticion(request: Request): { ip: string | null; userAgent: string | null } {
  // `x-forwarded-for` puede traer una lista; el primer valor es el cliente.
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? (forwarded.split(',')[0] ?? '').trim() || null : null;

  return {
    ip,
    userAgent: request.headers.get('user-agent'),
  };
}
