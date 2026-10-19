'use server';

import { revalidatePath } from 'next/cache';
import { requierePermiso } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { configuracionIA } from '@/lib/ia';
import { CLAVE_IA } from '@/services/ai/settings';
import { registrarAuditoria } from '@/services/auditService';
import type { EstadoFormulario } from '@/components/admin/formulario-accion';
import { mensajeDeErrorDeAccion } from '@/lib/api/responses';

export async function guardarIA(_estado: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('settings:manage');
    const value = configuracionIA.parse({ enabled: form.has('enabled'), publicEnabled: form.has('publicEnabled'), dailyTokens: Number(form.get('dailyTokens')), monthlyTokens: Number(form.get('monthlyTokens')) });
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext('fiscalizador-ia-budget'))`;
      await tx.appSetting.upsert({ where: { key: CLAVE_IA }, create: { key: CLAVE_IA, value }, update: { value } });
      await registrarAuditoria(tx, { userId: usuario.id, action: 'CHANGE_SETTINGS', entity: 'AppSetting', entityId: CLAVE_IA, metadata: value });
    });
    revalidatePath('/admin/ia');
    return { ok: 'Configuración de IA guardada.', error: null };
  } catch (error) { return { ok: null, error: mensajeDeErrorDeAccion(error) }; }
}
