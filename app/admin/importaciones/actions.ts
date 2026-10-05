'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { EstadoFormulario } from '@/components/admin/formulario-accion';
import { mensajeDeErrorDeAccion } from '@/lib/api/responses';
import { requierePermiso } from '@/lib/auth/session';
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
