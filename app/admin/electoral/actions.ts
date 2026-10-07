'use server';
import { revalidatePath } from 'next/cache';
import { requierePermiso } from '@/lib/auth/session';
import { mensajeDeErrorDeAccion } from '@/lib/api/responses';
import type { EstadoFormulario } from '@/components/admin/formulario-accion';
import { guardarPersonaElectoral, guardarRegistroElectoral, eliminarRegistroElectoral } from '@/services/electoralService';
import { esquemaPersonaElectoral, esquemaRegistroElectoral } from '@/lib/electoral';

function refrescar() { revalidatePath('/admin/electoral'); revalidatePath('/electoral', 'layout'); revalidatePath('/proveedores', 'layout'); }
export async function accionPersonaElectoral(_estado: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  try {
    const user = await requierePermiso('persons:write');
    const input = esquemaPersonaElectoral.parse({ id: form.get('id') || undefined, fullName: form.get('fullName'), dni: form.get('dni'), isPublic: form.has('isPublic') });
    await guardarPersonaElectoral({ ...input, dni: input.dni ?? '' }, user.id);
    refrescar(); return { error: null, ok: 'Persona electoral guardada.' };
  } catch (error) { return { error: mensajeDeErrorDeAccion(error), ok: null }; }
}
export async function accionRegistroElectoral(_estado: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  try {
    const user = await requierePermiso('persons:write');
    const input = esquemaRegistroElectoral.parse({ ...Object.fromEntries(form), id: form.get('id') || undefined, isPublic: form.has('isPublic') });
    await guardarRegistroElectoral(input, user.id);
    refrescar(); return { error: null, ok: 'Antecedente electoral guardado.' };
  } catch (error) { return { error: mensajeDeErrorDeAccion(error), ok: null }; }
}
export async function accionEliminarRegistroElectoral(_estado: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  try {
    const user = await requierePermiso('persons:write');
    const id = form.get('id');
    if (typeof id !== 'string' || !id || id.length > 64) return { error: 'Registro no válido.', ok: null };
    await eliminarRegistroElectoral(id, user.id);
    refrescar(); return { error: null, ok: 'Antecedente electoral eliminado.' };
  } catch (error) { return { error: mensajeDeErrorDeAccion(error), ok: null }; }
}
