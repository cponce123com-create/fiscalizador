'use server';

import { revalidatePath } from 'next/cache';
import type { EstadoFormulario } from '@/components/admin/formulario-accion';
import { mensajeDeErrorDeAccion } from '@/lib/api/responses';
import { requierePermiso } from '@/lib/auth/session';
import { clavePortal, esquemaPortal } from '@/lib/portal-settings';
import { prisma } from '@/lib/prisma';
import { registrarAuditoria } from '@/services/auditService';
import { asegurarMunicipalidadActiva } from '@/services/municipalityService';

export async function guardarApariencia(_estado: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('settings:manage');
    const municipalityId = await asegurarMunicipalidadActiva(String(form.get('municipalityId') ?? ''));
    const key = clavePortal(municipalityId);
    const datos = esquemaPortal.parse({ municipio: form.get('municipio'), cintaActiva: form.has('cintaActiva'), titular: form.get('titular'), enlace: form.get('enlace'), velocidad: form.get('velocidad'), fotoPortada: form.get('fotoPortada') ?? '', creditoFoto: form.get('creditoFoto') ?? '' });
    await prisma.$transaction(async (tx) => {
      await tx.appSetting.upsert({ where: { key }, create: { key, value: datos }, update: { value: datos } });
      await registrarAuditoria(tx, { userId: usuario.id, action: 'CHANGE_SETTINGS', entity: 'AppSetting', entityId: key, metadata: { ...datos, municipalityId } });
    });
    revalidatePath('/', 'layout');
    revalidatePath('/admin/apariencia');
    return { ok: 'Apariencia y titular guardados.', error: null };
  } catch (error) { return { ok: null, error: mensajeDeErrorDeAccion(error) }; }
}
