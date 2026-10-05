'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { EstadoFormulario } from '@/components/admin/formulario-accion';
import { mensajeDeErrorDeAccion } from '@/lib/api/responses';
import { requierePermiso } from '@/lib/auth/session';
import { actualizarEtiqueta, crearEtiqueta, eliminarEtiqueta } from '@/services/personsService';

/**
 * Acciones del catálogo de etiquetas.
 *
 * El código de la etiqueta se normaliza en el servicio (mayúsculas y guiones
 * bajos): es la clave con la que se agrupan las sumas, así que no puede depender
 * de cómo se escriba en el formulario.
 */

function texto(valor: FormDataEntryValue | null): string {
  return typeof valor === 'string' ? valor : '';
}

const esquemaEtiqueta = z.object({
  code: z.string().max(64),
  label: z.string().max(120),
  position: z.coerce.number().int().min(0).max(999),
  isActive: z.boolean(),
  isPublic: z.boolean(),
});

const esquemaIdentificador = z.object({ id: z.string().min(1).max(64) });

function entradaEtiqueta(formData: FormData) {
  return esquemaEtiqueta.parse({
    code: texto(formData.get('code')),
    label: texto(formData.get('label')),
    position: texto(formData.get('position')) || '0',
    isActive: formData.get('isActive') !== null,
    isPublic: formData.get('isPublic') !== null,
  });
}

export async function accionCrearEtiqueta(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('persons:write');
    const datos = entradaEtiqueta(formData);

    await crearEtiqueta(datos, { userId: usuario.id });
    revalidatePath('/admin/etiquetas');
    revalidatePath('/admin/personas');

    return { error: null, ok: `Etiqueta «${datos.label.trim()}» creada.` };
  } catch (error) {
    return { error: mensajeDeErrorDeAccion(error), ok: null };
  }
}

export async function accionActualizarEtiqueta(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('persons:write');
    const { id } = esquemaIdentificador.parse({ id: texto(formData.get('id')) });
    const datos = entradaEtiqueta(formData);

    await actualizarEtiqueta(id, datos, { userId: usuario.id });
    revalidatePath('/admin/etiquetas');
    revalidatePath('/admin/personas');

    return { error: null, ok: `Etiqueta «${datos.label.trim()}» actualizada.` };
  } catch (error) {
    return { error: mensajeDeErrorDeAccion(error), ok: null };
  }
}

export async function accionEliminarEtiqueta(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('persons:write');
    const { id } = esquemaIdentificador.parse({ id: texto(formData.get('id')) });

    await eliminarEtiqueta(id, { userId: usuario.id });
    revalidatePath('/admin/etiquetas');
    revalidatePath('/admin/personas');

    return { error: null, ok: 'Etiqueta eliminada.' };
  } catch (error) {
    return { error: mensajeDeErrorDeAccion(error), ok: null };
  }
}
