/**
 * Señales textuales para encontrar posibles servicios de prensa y comunicación.
 * Solo crean una cola de revisión: una coincidencia no etiqueta ni publica a nadie.
 */
export const PATRON_CONTENIDO_PRENSA = String.raw`(^| )(prensa|periodistas?|periodisticos?|periodisticas?|publicidad|publicitarios?|publicitarias?|difusion|radiodifusion|spots?|comunicados?|comunicacion social|medios? de comunicacion|relaciones publicas|pautas? publicitarias?|coberturas? (periodisticas?|informativas?)|notas? de prensa|avisos? (radiales?|televisivos?|publicitarios?)|espacios? (radiales?|televisivos?)|transmisiones? (radiales?|televisivas?)|servicios? (radiales?|televisivos?)|produccion(es)? audiovisuales?|videos? institucionales?|perifoneo)( |$)`;
export const PATRON_EXCLUSION_PRENSA = String.raw`(^| )prensas? (hidraulicas?|mecanicas?|industriales?)( |$)`;

export function pareceContenidoDePrensa(descripcion: string | null | undefined): boolean {
  const normal = (descripcion ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return new RegExp(PATRON_CONTENIDO_PRENSA).test(normal) && !new RegExp(PATRON_EXCLUSION_PRENSA).test(normal);
}
