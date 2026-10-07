'use server';

import { revalidatePath } from 'next/cache';
import type { EstadoFormulario } from '@/components/admin/formulario-accion';
import { mensajeDeErrorDeAccion } from '@/lib/api/responses';
import { requierePermiso } from '@/lib/auth/session';
import { CLAVE_PORTAL, esquemaPortal } from '@/lib/portal-settings';
import { prisma } from '@/lib/prisma';
import { registrarAuditoria } from '@/services/auditService';

export async function guardarApariencia(_estado: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('settings:manage');
    const datos = esquemaPortal.parse({ municipio: form.get('municipio'), cintaActiva: form.has('cintaActiva'), titular: form.get('titular'), enlace: form.get('enlace'), velocidad: form.get('velocidad'), fotoPortada: form.get('fotoPortada') ?? '', creditoFoto: form.get('creditoFoto') ?? '' });
    await prisma.$transaction(async (tx) => {
      await tx.appSetting.upsert({ where: { key: CLAVE_PORTAL }, create: { key: CLAVE_PORTAL, value: datos }, update: { value: datos } });
      await registrarAuditoria(tx, { userId: usuario.id, action: 'CHANGE_SETTINGS', entity: 'AppSetting', entityId: CLAVE_PORTAL, metadata: datos });
    });
    revalidatePath('/', 'layout');
    revalidatePath('/admin/apariencia');
    return { ok: 'Apariencia y titular guardados.', error: null };
  } catch (error) { return { ok: null, error: mensajeDeErrorDeAccion(error) }; }
}
