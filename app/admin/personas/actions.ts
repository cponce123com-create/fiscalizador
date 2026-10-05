'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { EstadoFormulario } from '@/components/admin/formulario-accion';
import { mensajeDeErrorDeAccion } from '@/lib/api/responses';
import { requierePermiso } from '@/lib/auth/session';
import {
  actualizarPersona,
  crearPersona,
  desvincularProveedor,
  eliminarPersona,
  vincularProveedor,
} from '@/services/personsService';

/**
 * Acciones del panel para las personas señaladas y sus vínculos con proveedores.
 *
 * Cada acción vuelve a comprobar el permiso contra la base de datos: el panel ya
 * oculta la interfaz, pero un formulario enviado a mano no pasa por ella.
 */

/** Lee un campo de texto sin confiar en el tipo que llega. */
function texto(valor: FormDataEntryValue | null): string {
  return typeof valor === 'string' ? valor : '';
}

/**
 * El esquema comprueba la FORMA y los topes de longitud: es la frontera con el
 * navegador. Las reglas de negocio (los ocho dígitos del DNI, la obligatoriedad de
 * la descripción y de la fuente, la unicidad) viven en el servicio, para que no
 * haya dos verdades sobre lo mismo.
 */
const esquemaEntrada = z.object({
  dni: z.string().max(20),
  fullName: z.string().max(200),
  description: z.string().max(4000),
  source: z.string().max(500),
  sourceUrl: z.string().max(500),
  isPublic: z.boolean(),
  tagIds: z.array(z.string().max(64)).max(50),
});

const esquemaVinculo = z.object({
  personId: z.string().min(1).max(64),
  ruc: z.string().max(20),
  note: z.string().max(500),
});

const esquemaIdentificador = z.object({ id: z.string().min(1).max(64) });

function entradaPersona(formData: FormData) {
  return esquemaEntrada.parse({
    dni: texto(formData.get('dni')),
    fullName: texto(formData.get('fullName')),
    description: texto(formData.get('description')),
    source: texto(formData.get('source')),
    sourceUrl: texto(formData.get('sourceUrl')),
    // La casilla solo viaja cuando está marcada.
    isPublic: formData.get('isPublic') !== null,
    tagIds: formData
      .getAll('tagIds')
      .filter((valor): valor is string => typeof valor === 'string'),
  });
}

export async function accionCrearPersona(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('persons:write');
    const datos = entradaPersona(formData);

    await crearPersona(datos, { userId: usuario.id });
    revalidatePath('/admin/personas');

    return { error: null, ok: `Ficha de ${datos.fullName.trim()} guardada.` };
  } catch (error) {
    return { error: mensajeDeErrorDeAccion(error), ok: null };
  }
}

export async function accionActualizarPersona(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('persons:write');
    const { id } = esquemaIdentificador.parse({ id: texto(formData.get('id')) });
    const datos = entradaPersona(formData);

    await actualizarPersona(id, datos, { userId: usuario.id });
    revalidatePath('/admin/personas');

    return { error: null, ok: `Ficha de ${datos.fullName.trim()} actualizada.` };
  } catch (error) {
    return { error: mensajeDeErrorDeAccion(error), ok: null };
  }
}

export async function accionEliminarPersona(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('persons:write');
    const { id } = esquemaIdentificador.parse({ id: texto(formData.get('id')) });

    await eliminarPersona(id, { userId: usuario.id });
    revalidatePath('/admin/personas');

    return { error: null, ok: 'Ficha eliminada.' };
  } catch (error) {
    return { error: mensajeDeErrorDeAccion(error), ok: null };
  }
}

export async function accionVincularProveedor(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('persons:write');
    const datos = esquemaVinculo.parse({
      personId: texto(formData.get('personId')),
      ruc: texto(formData.get('ruc')),
      note: texto(formData.get('note')),
    });

    await vincularProveedor(
      { personId: datos.personId, ruc: datos.ruc, note: datos.note || null },
      { userId: usuario.id },
    );
    revalidatePath('/admin/personas');

    return { error: null, ok: 'Proveedor vinculado.' };
  } catch (error) {
    return { error: mensajeDeErrorDeAccion(error), ok: null };
  }
}

export async function accionDesvincularProveedor(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('persons:write');
    const { id } = esquemaIdentificador.parse({ id: texto(formData.get('linkId')) });

    await desvincularProveedor(id, { userId: usuario.id });
    revalidatePath('/admin/personas');

    return { error: null, ok: 'Vínculo quitado.' };
  } catch (error) {
    return { error: mensajeDeErrorDeAccion(error), ok: null };
  }
}
