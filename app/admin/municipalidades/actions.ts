'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { EstadoFormulario } from '@/components/admin/formulario-accion';
import { mensajeDeErrorDeAccion } from '@/lib/api/responses';
import { requierePermiso } from '@/lib/auth/session';
import { guardarMunicipalidad } from '@/services/municipalityService';
import { CATEGORIAS_ENTIDAD_PUBLICA, type CategoriaEntidadPublica } from '@/lib/entidad-publica';

function texto(valor: FormDataEntryValue | null): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

const esquema = z.object({
  id: z.string().max(80).optional(),
  nombre: z.string().trim().min(3).max(180),
  nombreCorto: z.string().trim().min(2).max(80),
  ruc: z.string().trim().regex(/^\d{11}$/, 'El RUC debe tener 11 dígitos.'),
  provincia: z.string().trim().min(2).max(80),
  departamento: z.string().trim().min(2).max(80),
  tipoEntidad: z.string().trim().min(2).max(40),
  categoria: z.string().refine((id) => CATEGORIAS_ENTIDAD_PUBLICA.some((categoria) => categoria.id === id), 'Selecciona una categoría válida.'),
  codigoOficial: z.string().trim().max(40).optional(),
  entidadSuperiorRuc: z.union([z.literal(''), z.string().trim().regex(/^\d{11}$/, 'El RUC de la entidad superior debe tener 11 dígitos.')]).optional(),
  slug: z.string().trim().max(80).optional(),
  colorPrincipal: z.string().trim().max(20).optional(),
  activa: z.boolean(),
  predeterminada: z.boolean(),
});

export async function accionGuardarMunicipalidad(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const usuario = await requierePermiso('settings:manage');
    const datos = esquema.parse({
      id: texto(formData.get('id')) || undefined,
      nombre: texto(formData.get('nombre')),
      nombreCorto: texto(formData.get('nombreCorto')),
      ruc: texto(formData.get('ruc')).replace(/\D/g, ''),
      provincia: texto(formData.get('provincia')),
      departamento: texto(formData.get('departamento')),
      tipoEntidad: texto(formData.get('tipoEntidad')) || 'DISTRITAL',
      categoria: texto(formData.get('categoria')) || 'MUNICIPALIDAD',
      codigoOficial: texto(formData.get('codigoOficial')) || undefined,
      entidadSuperiorRuc: texto(formData.get('entidadSuperiorRuc')) || undefined,
      slug: texto(formData.get('slug')) || undefined,
      colorPrincipal: texto(formData.get('colorPrincipal')) || undefined,
      activa: formData.get('activa') !== null,
      predeterminada: formData.get('predeterminada') !== null,
    });

    await guardarMunicipalidad({ ...datos, categoria: datos.categoria as CategoriaEntidadPublica, userId: usuario.id });
    revalidatePath('/', 'layout');
    revalidatePath('/admin/municipalidades');
    revalidatePath('/admin/importar');
    return { error: null, ok: datos.id ? 'Entidad actualizada.' : 'Entidad creada.' };
  } catch (error) {
    return { error: mensajeDeErrorDeAccion(error), ok: null };
  }
}
