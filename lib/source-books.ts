export const MESES_LIBROS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export type EstadoLibro = { status: string; isCurrent: boolean; requiresReview: boolean };
export function libroImportado(libro: Pick<EstadoLibro, 'status'>): boolean {
  return ['COMPLETED', 'COMPLETED_WITH_WARNINGS'].includes(libro.status);
}
export function estadoLibro(libro: EstadoLibro): { etiqueta: string; tono: 'exito' | 'advertencia' | 'error' | 'neutro'; detalle: string } {
  if (libroImportado(libro)) {
    if (libro.requiresReview) return { etiqueta: 'Importado · no incluido en totales', tono: 'advertencia', detalle: 'Este libro tiene datos importados, pero no está incorporado a los totales actuales.' };
    return libro.isCurrent
      ? { etiqueta: libro.status === 'COMPLETED_WITH_WARNINGS' ? 'Vigente · con observaciones' : 'Vigente', tono: libro.status === 'COMPLETED_WITH_WARNINGS' ? 'advertencia' : 'exito', detalle: 'Sus órdenes se consideran en los totales del portal según su estado.' }
      : { etiqueta: 'Versión anterior', tono: 'neutro', detalle: 'Se conserva como referencia; sus órdenes no se suman a los totales actuales.' };
  }
  const estados: Record<string, string> = { UPLOADED: 'Cargado · sin importar', VALIDATING: 'En validación', PROCESSING: 'Importando', FAILED: 'Importación fallida' };
  return { etiqueta: estados[libro.status] ?? 'Sin datos importados', tono: libro.status === 'FAILED' ? 'error' : 'neutro', detalle: libro.status === 'FAILED' ? 'La importación no se completó correctamente. Este archivo no aporta órdenes a los totales.' : 'El archivo está registrado, pero la importación no ha finalizado. No aporta órdenes a los totales.' };
}
export function coberturaLibros(libros: EstadoLibro[]): { etiqueta: string; tono: 'exito' | 'advertencia' | 'error' | 'neutro' } {
  if (!libros.length) return { etiqueta: 'Sin libro cargado', tono: 'neutro' };
  const vigente = libros.find(b => libroImportado(b) && b.isCurrent && !b.requiresReview);
  if (vigente) return { etiqueta: vigente.status === 'COMPLETED_WITH_WARNINGS' ? 'Importado con observaciones' : 'Importado', tono: vigente.status === 'COMPLETED_WITH_WARNINGS' ? 'advertencia' : 'exito' };
  if (libros.some(libroImportado)) return { etiqueta: 'Libros importados sin versión vigente', tono: 'advertencia' };
  if (libros.some(b => ['UPLOADED', 'VALIDATING', 'PROCESSING'].includes(b.status))) return { etiqueta: 'Cargado · importación sin finalizar', tono: 'advertencia' };
  return { etiqueta: 'Importación fallida', tono: 'error' };
}
