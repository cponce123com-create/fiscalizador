/** Palabras completas sobre la descripción normalizada, compartidas con PostgreSQL. */
export const patronAlimentacion = '(^| )(alimentacion|alimentos?|refrigerios?|comidas?|almuerzos?|cenas?|desayunos?|bocaditos?|lonches?|catering|buffets?|bufets?|banquetes?|racion(es)?)( |$)';
export const patronExclusionAlimentacion = '(^| )(animales?|mascotas?|caninos?|felinos?|ganado|balanceados?)( |$)|(^| )fuentes? de alimentacion( |$)|(^| )alimentacion (electrica|electrico|ininterrumpida)( |$)';

export function esAlimentacion(descripcion: string | null): boolean {
  const normal = (descripcion ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return new RegExp(patronAlimentacion).test(normal) && !new RegExp(patronExclusionAlimentacion).test(normal);
}

export type GastoAlimentacionGestion = {
  id: string;
  gestion: string;
  meses: number;
  ordenes: number;
  anuladas: number;
  considerado: string;
};
