'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { EstadoFormulario } from '@/components/admin/formulario-accion';
import { mensajeDeErrorDeAccion } from '@/lib/api/responses';
import { requierePermiso } from '@/lib/auth/session';
import {
  actualizarEstado,
  actualizarGestion,
  actualizarTipoDeContratacion,
  actualizarTipoDeOrden,
  crearEstado,
  crearGestion,
  crearTipoDeContratacion,
  crearTipoDeOrden,
  eliminarEstado,
  eliminarGestion,
  eliminarTipoDeContratacion,
  eliminarTipoDeOrden,
} from '@/services/catalogService';

/**
 * Acciones de los catálogos configurables.
 *
 * Lo que se toca aquí decide qué suma al gasto publicado —sobre todo el estado—, así que
 * exige `imports:write`, el mismo permiso que importar: quien puede cambiar las cifras
 * importando puede cambiarlas clasificando, y quien no, no. Cada cambio queda auditado
 * en el servicio, con el antes y el después.
 *
 * El permiso se comprueba en CADA acción, no solo al pintar la página: esconder un
 * formulario no protege nada.
 */

function texto(valor: FormDataEntryValue | null): string {
  return typeof valor === 'string' ? valor : '';
}

/** Las casillas sin marcar no viajan en el formulario: su ausencia es el `false`. */
function casilla(formData: FormData, nombre: string): boolean {
  return formData.get(nombre) !== null;
}

/** Alias separados por comas, como se teclean. */
function aliasDe(formData: FormData): string[] {
  return texto(formData.get('aliases'))
    .split(',')
    .map((parte) => parte.trim())
    .filter((parte) => parte !== '');
}

function revalidar(): void {
  revalidatePath('/admin/catalogos');
  // El estado decide el monto considerado, así que la portada y las estadísticas
  // cambian con él. Son dinámicas, pero revalidarlas es barato y deja claro el alcance.
  revalidatePath('/');
  revalidatePath('/estadisticas');
}

const esquemaIdentificador = z.object({ id: z.string().min(1).max(64) });

const esquemaEstado = z.object({
  code: z.string().max(64),
  label: z.string().max(120),
  aliases: z.array(z.string().max(120)).max(50),
  countsEconomically: z.boolean(),
  isCancelled: z.boolean(),
  isUnknown: z.boolean(),
  position: z.coerce.number().int().min(0).max(999),
  isActive: z.boolean(),
});

const esquemaTipo = z.object({
  code: z.string().max(64),
  label: z.string().max(200),
  aliases: z.array(z.string().max(120)).max(50),
  position: z.coerce.number().int().min(0).max(999),
  isActive: z.boolean(),
});

const esquemaGestion = z.object({
  name: z.string().max(120),
  startDate: z.string().max(10),
  endDate: z.string().max(10),
  description: z.string().max(500),
});

function entradaEstado(formData: FormData) {
  return esquemaEstado.parse({
    code: texto(formData.get('code')),
    label: texto(formData.get('label')),
    aliases: aliasDe(formData),
    countsEconomically: casilla(formData, 'countsEconomically'),
    isCancelled: casilla(formData, 'isCancelled'),
    isUnknown: casilla(formData, 'isUnknown'),
    position: texto(formData.get('position')) || '0',
    isActive: casilla(formData, 'isActive'),
  });
}

function entradaTipo(formData: FormData) {
  return esquemaTipo.parse({
    code: texto(formData.get('code')),
    label: texto(formData.get('label')),
    aliases: aliasDe(formData),
    position: texto(formData.get('position')) || '0',
    isActive: casilla(formData, 'isActive'),
  });
}

function entradaGestion(formData: FormData) {
  return esquemaGestion.parse({
    name: texto(formData.get('name')),
    startDate: texto(formData.get('startDate')),
    endDate: texto(formData.get('endDate')),
    description: texto(formData.get('description')),
  });
}

// =============================================================================
// Estados
// =============================================================================

export async function accionCrearEstado(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('imports:write');
    const datos = entradaEstado(formData);

    await crearEstado(datos, { userId: usuario.id });
    revalidar();

    return { error: null, ok: `Estado «${datos.label.trim()}» creado.` };
  } catch (error) {
    return { error: mensajeDeErrorDeAccion(error), ok: null };
  }
}

export async function accionActualizarEstado(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('imports:write');
    const { id } = esquemaIdentificador.parse({ id: texto(formData.get('id')) });
    const datos = entradaEstado(formData);

    await actualizarEstado(id, datos, { userId: usuario.id });
    revalidar();

    return { error: null, ok: `Estado «${datos.label.trim()}» actualizado.` };
  } catch (error) {
    return { error: mensajeDeErrorDeAccion(error), ok: null };
  }
}

export async function accionEliminarEstado(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('imports:write');
    const { id } = esquemaIdentificador.parse({ id: texto(formData.get('id')) });

    await eliminarEstado(id, { userId: usuario.id });
    revalidar();

    return { error: null, ok: 'Estado eliminado.' };
  } catch (error) {
    return { error: mensajeDeErrorDeAccion(error), ok: null };
  }
}

// =============================================================================
// Tipos de orden
// =============================================================================

export async function accionCrearTipoDeOrden(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('imports:write');
    const datos = entradaTipo(formData);

    await crearTipoDeOrden(datos, { userId: usuario.id });
    revalidar();

    return { error: null, ok: `Tipo de orden «${datos.label.trim()}» creado.` };
  } catch (error) {
    return { error: mensajeDeErrorDeAccion(error), ok: null };
  }
}

export async function accionActualizarTipoDeOrden(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('imports:write');
    const { id } = esquemaIdentificador.parse({ id: texto(formData.get('id')) });
    const datos = entradaTipo(formData);

    await actualizarTipoDeOrden(id, datos, { userId: usuario.id });
    revalidar();

    return { error: null, ok: `Tipo de orden «${datos.label.trim()}» actualizado.` };
  } catch (error) {
    return { error: mensajeDeErrorDeAccion(error), ok: null };
  }
}

export async function accionEliminarTipoDeOrden(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('imports:write');
    const { id } = esquemaIdentificador.parse({ id: texto(formData.get('id')) });

    await eliminarTipoDeOrden(id, { userId: usuario.id });
    revalidar();

    return { error: null, ok: 'Tipo de orden eliminado.' };
  } catch (error) {
    return { error: mensajeDeErrorDeAccion(error), ok: null };
  }
}

// =============================================================================
// Tipos de contratación
// =============================================================================

export async function accionCrearTipoDeContratacion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('imports:write');
    const datos = entradaTipo(formData);

    await crearTipoDeContratacion(datos, { userId: usuario.id });
    revalidar();

    return { error: null, ok: `Tipo de contratación «${datos.label.trim()}» creado.` };
  } catch (error) {
    return { error: mensajeDeErrorDeAccion(error), ok: null };
  }
}

export async function accionActualizarTipoDeContratacion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('imports:write');
    const { id } = esquemaIdentificador.parse({ id: texto(formData.get('id')) });
    const datos = entradaTipo(formData);

    await actualizarTipoDeContratacion(id, datos, { userId: usuario.id });
    revalidar();

    return { error: null, ok: `Tipo de contratación «${datos.label.trim()}» actualizado.` };
  } catch (error) {
    return { error: mensajeDeErrorDeAccion(error), ok: null };
  }
}

export async function accionEliminarTipoDeContratacion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('imports:write');
    const { id } = esquemaIdentificador.parse({ id: texto(formData.get('id')) });

    await eliminarTipoDeContratacion(id, { userId: usuario.id });
    revalidar();

    return { error: null, ok: 'Tipo de contratación eliminado.' };
  } catch (error) {
    return { error: mensajeDeErrorDeAccion(error), ok: null };
  }
}

// =============================================================================
// Gestiones
// =============================================================================

export async function accionCrearGestion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('imports:write');
    const datos = entradaGestion(formData);

    await crearGestion(datos, { userId: usuario.id });
    revalidar();

    return { error: null, ok: `Gestión «${datos.name.trim()}» creada.` };
  } catch (error) {
    return { error: mensajeDeErrorDeAccion(error), ok: null };
  }
}

export async function accionActualizarGestion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('imports:write');
    const { id } = esquemaIdentificador.parse({ id: texto(formData.get('id')) });
    const datos = entradaGestion(formData);

    await actualizarGestion(id, datos, { userId: usuario.id });
    revalidar();

    return { error: null, ok: `Gestión «${datos.name.trim()}» actualizada.` };
  } catch (error) {
    return { error: mensajeDeErrorDeAccion(error), ok: null };
  }
}

export async function accionEliminarGestion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('imports:write');
    const { id } = esquemaIdentificador.parse({ id: texto(formData.get('id')) });

    await eliminarGestion(id, { userId: usuario.id });
    revalidar();

    return { error: null, ok: 'Gestión eliminada.' };
  } catch (error) {
    return { error: mensajeDeErrorDeAccion(error), ok: null };
  }
}
