'use server';
import { revalidatePath } from 'next/cache';
import type { EstadoFormulario } from '@/components/admin/formulario-accion';
import { requierePermiso } from '@/lib/auth/session';
import { mensajeDeErrorDeAccion } from '@/lib/api/responses';
import { esquemaPerfilProveedor, camposPublicacionProveedor } from '@/lib/supplier-profile';
import { guardarPerfilProveedor } from '@/services/supplierProfileService';
export async function accionGuardarPerfilProveedor(_estado: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('persons:write');
    const contactos = form.get('contacts');
    let contacts: unknown;
    try { contacts = JSON.parse(typeof contactos === 'string' ? contactos : '[]'); }
    catch { return { error: 'La lista de personas vinculadas no es válida.', ok: null }; }
    const input = esquemaPerfilProveedor.parse({ isPublic: form.has('isPublic'), publication: Object.fromEntries(camposPublicacionProveedor.map(c => [c, { enabled: form.has(`publish_${c}`), sourceUrl: form.get(`source_${c}`) || null }])), supplierId: form.get('supplierId'), version: form.get('version'), publicNotes: form.get("publicNotes"), publicSourceUrl: form.get("publicSourceUrl"), publicDistrict: form.get("publicDistrict"), birthDate: form.get("birthDate"), birthplace: form.get('birthplace'), currentAddress: form.get('currentAddress'), notes: form.get('notes'), contacts });
    await guardarPerfilProveedor(input, usuario.id);
    revalidatePath(`/admin/proveedores/${input.supplierId}`);
    revalidatePath('/admin/proveedores');
    revalidatePath('/proveedores', 'layout');
    revalidatePath('/');
    return { error: null, ok: 'Perfil guardado. Solo se publican los datos habilitados con su fuente revisada.' };
  } catch (error) { return { error: mensajeDeErrorDeAccion(error), ok: null }; }
}
