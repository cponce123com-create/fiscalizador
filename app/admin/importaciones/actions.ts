'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { EstadoFormulario } from '@/components/admin/formulario-accion';
import { mensajeDeErrorDeAccion } from '@/lib/api/responses';
import { requierePermiso } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { registrarAuditoria } from '@/services/auditService';
import { claveOriginal, leerOriginalVerificado, tieneColumnasPrivadas } from '@/services/bookPublicationService';
import { eliminarTodasImportaciones } from '@/services/bulkImportDeletionService';
import { eliminarImportacion } from '@/services/importService';

/**
 * Eliminar una importación.
 *
 * Es la única acción del panel que borra datos del portal, así que exige
 * `imports:write` (ADMIN o superior) y deja rastro en la auditoría. El servicio se
 * encarga de rehacer los resúmenes por gestión: sin eso, el portal seguiría sumando
 * órdenes que ya no existen.
 */

function texto(valor: FormDataEntryValue | null): string {
  return typeof valor === 'string' ? valor : '';
}

const esquema = z.object({
  importBatchId: z.string().min(1).max(64),
  /** La casilla solo viaja cuando está marcada. */
  borrarProveedores: z.boolean(),
});

export async function accionEliminarImportacion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('imports:write');

    const datos = esquema.parse({
      importBatchId: texto(formData.get('importBatchId')),
      borrarProveedores: formData.get('borrarProveedores') !== null,
    });

    const resultado = await eliminarImportacion({
      importBatchId: datos.importBatchId,
      userId: usuario.id,
      borrarProveedoresHuerfanos: datos.borrarProveedores,
    });

    revalidatePath('/admin/importaciones');

    const proveedores =
      resultado.proveedoresEliminados > 0
        ? ` y ${resultado.proveedoresEliminados} proveedor(es)`
        : '';

    return {
      error: null,
      ok: `Importación ${resultado.period} v${resultado.version} eliminada: ${resultado.ordenesEliminadas} orden(es)${proveedores}.`,
    };
  } catch (error) {
    return { error: mensajeDeErrorDeAccion(error), ok: null };
  }
}

export async function accionPublicarOriginal(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('imports:write');
    const id = z.string().min(1).max(64).parse(texto(formData.get('importBatchId')));
    const publicado = formData.get('publicarOriginal') !== null;
    const lote = await prisma.importBatch.findUnique({ where: { id } });
    if (!lote) throw new Error('No existe esta importación.');
    if (publicado) {
      if (formData.get('revisionOriginal') === null) throw new Error('Confirma que revisaste todas las hojas y columnas del original.');
      if (!['COMPLETED', 'COMPLETED_WITH_WARNINGS'].includes(lote.status)) throw new Error('Solo se publican originales de importaciones completadas.');
      if (await tieneColumnasPrivadas(id)) throw new Error('Este libro contiene columnas restringidas. Publica únicamente el extracto.');
      if (!lote.storageKey) throw new Error('El archivo original no está disponible.');
      try { await leerOriginalVerificado(lote.storageKey, lote.checksum); }
      catch { throw new Error('El original no está disponible o no coincide con su huella. Revisa el almacenamiento del archivo.'); }
    }
    await prisma.$transaction(async tx => {
      await tx.appSetting.upsert({ where: { key: claveOriginal(id) }, create: { key: claveOriginal(id), value: { publicado } }, update: { value: { publicado } } });
      await registrarAuditoria(tx, { userId: usuario.id, action: 'CHANGE_SETTINGS', entity: 'ImportBatch', entityId: id, metadata: { originalPublicado: publicado } });
    });
    revalidatePath('/admin/importaciones');
    revalidatePath('/fuentes');
    return { error: null, ok: publicado ? 'Descarga del original publicada.' : 'Descarga del original desactivada.' };
  } catch (error) {
    return { error: mensajeDeErrorDeAccion(error), ok: null };
  }
}

export async function accionEliminarTodasImportaciones(_estado: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('imports:write');
    const huella = z.string().regex(/^[a-f0-9]{64}$/).parse(texto(formData.get('huella')));
    const resultado = await eliminarTodasImportaciones({ userId: usuario.id, huella, confirmacion: texto(formData.get('confirmacion')) });
    revalidatePath('/', 'layout');
    return { error: null, ok: `${resultado.lotes} importaciones y ${resultado.ordenes} órdenes eliminadas. Se conservaron los proveedores, perfiles, fotos y vínculos.${resultado.archivosPendientes ? ` No se pudieron retirar ${resultado.archivosPendientes} archivos del almacenamiento; revisa los originales antes de volver a cargar.` : ''}` };
  } catch (error) { return { error: mensajeDeErrorDeAccion(error), ok: null }; }
}
