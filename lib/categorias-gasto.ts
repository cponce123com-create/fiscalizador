/** Patrones de palabras completas aplicados a descripciones normalizadas. */
export type CategoriaGasto = { id: string; titulo: string; descripcion: string; patrones: readonly [string, string]; excluir: string };
const palabras = (p: string) => `(^| )(${p})( |$)`;
const mantenimiento = palabras('mantenimientos?|reparacion(es)?|repuestos?|reparaciones|overhaul');
const vaso = palabras('vaso(s)? de leche|pvl');
export const categoriasGasto: readonly CategoriaGasto[] = [
  { id: 'alquiler-camionetas', titulo: 'Alquiler de camionetas', descripcion: 'Alquiler, arrendamiento y renta de camionetas o pick-up.', patrones: [palabras('alquiler(es)?|arrendamientos?|renta(s)?'), palabras('camionetas?|pick ?ups?')], excluir: '$^' },
  { id: 'maquinaria-pesada', titulo: 'Mantenimiento de maquinaria pesada', descripcion: 'Mantenimiento, reparaciones y repuestos de maquinaria pesada, excavadoras, cargadores, volquetes y similares.', patrones: [mantenimiento, palabras('maquinarias? pesadas?|excavadoras?|retroexcavadoras?|motoniveladoras?|cargador(es)? frontal(es)?|tractores?|bulldozers?|volquetes?|rodillos?')], excluir: '$^' },
  { id: 'consultorias', titulo: 'Consultorías', descripcion: 'Servicios descritos como consultoría o asesoría, incluidos los vinculados a expedientes técnicos.', patrones: [palabras('consultorias?|consultor(es)?|asesorias?'), '.*'], excluir: '$^' },
  { id: 'expedientes-tecnicos', titulo: 'Expedientes técnicos', descripcion: 'Elaboración, actualización, revisión y otros conceptos que mencionan expedientes técnicos.', patrones: [palabras('expedientes? tecnicos?'), '.*'], excluir: '$^' },
  { id: 'beneficios-personal', titulo: 'Sindicatos y beneficios del personal', descripcion: 'Sindicatos, canastas y leche expresamente vinculados al personal, trabajadores o convenios colectivos.', patrones: [palabras('sindicatos?|sindical(es)?|sindicalizados?|sindicalizadas?|sitramun|canastas?|leche'), palabras('sindicatos?|sindical(es)?|sindicalizados?|sindicalizadas?|sitramun|personal|trabajador(es)?|trabajadoras?|servidor(es)?|servidoras?|empleados?|empleadas?|obreros?|obreras?|convenios? colectivos?')], excluir: vaso },
  { id: 'vaso-de-leche', titulo: 'Programa Vaso de Leche', descripcion: 'Órdenes que mencionan Vaso de Leche o PVL; no se atribuye toda compra de leche al programa.', patrones: [vaso, '.*'], excluir: '$^' },
  { id: 'mantenimiento-vehiculos', titulo: 'Mantenimiento de camionetas y motos', descripcion: 'Mantenimiento, reparaciones y repuestos de camionetas, pick-up, motos y motocicletas.', patrones: [mantenimiento, palabras('camionetas?|pick ?ups?|motos?|motocicletas?|motociclos?|motocars?|motocarros?')], excluir: '$^' },
];
export function categoriaGastoPorId(id: string) { return categoriasGasto.find(c => c.id === id); }
export function coincideCategoriaGasto(categoria: CategoriaGasto, descripcion: string | null): boolean {
  const normal = (descripcion ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return categoria.patrones.every(p => new RegExp(p).test(normal)) && !new RegExp(categoria.excluir).test(normal);
}
