'use server';

import { revalidatePath } from 'next/cache';
import { requierePermiso } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { configuracionIA } from '@/lib/ia';
import { interpretarPregunta } from '@/services/ai/provider';
import { errorIA } from '@/services/ai/errors';
import { CLAVE_IA, reservarUso } from '@/services/ai/settings';
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

/** Prueba real del proveedor; no consulta ni envía órdenes o perfiles. Consume una reserva. */
export async function probarConexionIA(): Promise<EstadoFormulario> {
  try {
    await requierePermiso('settings:manage');
  } catch { return { ok: null, error: 'Necesitas permiso de configuración para probar la conexión.' }; }
  try {
    await reservarUso(false);
    const plan = await interpretarPregunta('Contrataciones durante 2025', []);
    if (plan.accion !== 'consultar' || plan.desde !== 2025 || plan.hasta !== 2025) throw new Error('IA_RESPUESTA');
    return { ok: 'Conexión comprobada: el proveedor autenticó la clave y el modelo devolvió filtros válidos. Ahora prueba una consulta de datos debajo.', error: null };
  } catch (error) { return { ok: null, error: errorIA(error).mensaje }; }
  finally { revalidatePath('/admin/ia'); }
}
