/** Señales amplias usadas en PostgreSQL para construir la cola de revisión. */
export const PATRON_CONTENIDO_PRENSA = String.raw`(^| )(prensa|periodistas?|periodisticos?|periodisticas?|publicidad|publicitarios?|publicitarias?|difusion|radiodifusion|spots?|comunicados?|comunicacion(es)? (social|institucional)|medios? (de comunicacion|digitales?)|relaciones publicas|pautas? publicitarias?|coberturas? (periodisticas?|informativas?)|notas? de prensa|avisos? (radiales?|televisivos?|publicitarios?)|espacios? (radiales?|televisivos?|contratados?)|transmisiones? (de eventos?|radiales?|televisivas?)|servicios? (radiales?|televisivos?|de prensa)|produccion(es)? audiovisuales?|videos? institucionales?|inserciones? publicitarias?|entrevistas? pagadas?|redes sociales|campanas? informativas?|perifoneo)( |$)`;
export const PATRON_EXCLUSION_PRENSA = String.raw`(^| )(prensas? (hidraulicas?|mecanicas?|industriales?)|papel prensa|libertad de prensa|impresora(s)? multifuncional(es)?)( |$)`;

export type NivelPrensa = 1 | 2 | 3 | 4;
export type ClasificacionPrensa = { nivel: NivelPrensa; etiqueta: string; confianza: number; razones: string[]; senales: string[] };
const fuertes: Array<[string, RegExp]> = [
  ['servicio de prensa', /\bservicios? de prensa\b/], ['cobertura periodística', /\bcoberturas? (periodisticas?|informativas?)\b/],
  ['medio de comunicación', /\bmedios? (de comunicacion|digitales?)\b/], ['spot radial o televisivo', /\bspots?( publicitarios?)? (radiales?|televisivos?)\b/],
  ['pauta o inserción publicitaria', /\b(pautas?|insercion(es)?) publicitarias?\b/], ['espacio radial o televisivo', /\bespacios? (radiales?|televisivos?)\b/],
  ['entrevista pagada', /\bentrevistas? pagadas?\b/], ['publicación periodística', /\bpublicaciones? periodisticas?\b/],
];
const comunicacionales: Array<[string, RegExp]> = [
  ['publicidad institucional', /\bpublicidad (institucional|publicitaria)\b/], ['difusión', /\b(difusion|radiodifusion)\b/],
  ['comunicado o nota de prensa', /\b(comunicados?|notas? de prensa)\b/], ['producción audiovisual', /\b(produccion(es)? audiovisuales?|videos? institucionales?)\b/],
  ['comunicación institucional', /\bcomunicacion(es)? (social|institucional)\b/], ['campaña informativa', /\bcampanas? informativas?\b/],
  ['difusión en redes sociales', /\bredes sociales\b/], ['transmisión de evento', /\btransmisiones? de eventos?\b/], ['perifoneo', /\bperifoneo\b/],
];
export function normalizarDescripcionPrensa(descripcion: string | null | undefined): string { return (descripcion ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
/** Clasifica señales, nunca hechos: nivel 1 exige además un proveedor documentado. */
export function clasificarContenidoPrensa(descripcion: string | null | undefined, proveedorDocumentado = false): ClasificacionPrensa {
  const normal = normalizarDescripcionPrensa(descripcion);
  if (!normal || new RegExp(PATRON_EXCLUSION_PRENSA).test(normal)) return { nivel: 4, etiqueta: 'Descartado por el algoritmo', confianza: 0, razones: ['No corresponde a servicios de prensa o comunicación'], senales: [] };
  const halladasFuertes = fuertes.filter(([, patron]) => patron.test(normal)).map(([nombre]) => nombre);
  const halladasComunicacion = comunicacionales.filter(([, patron]) => patron.test(normal)).map(([nombre]) => nombre);
  const senales = [...halladasFuertes, ...halladasComunicacion];
  if (proveedorDocumentado && senales.length) return { nivel: 1, etiqueta: 'Coincidencia documentada', confianza: 95, razones: ['Proveedor previamente identificado y contratación compatible'], senales };
  if (halladasFuertes.length) return { nivel: 2, etiqueta: 'Posible contratación de prensa', confianza: Math.min(90, 65 + halladasFuertes.length * 8 + halladasComunicacion.length * 3), razones: ['La descripción contiene señales específicas de contratación de medios o prensa', 'Requiere comprobar proveedor, fuente y naturaleza del servicio'], senales };
  if (halladasComunicacion.length) return { nivel: 3, etiqueta: 'Contratación comunicacional', confianza: Math.min(75, 45 + halladasComunicacion.length * 7), razones: ['Hay publicidad, difusión o producción comunicacional sin evidencia suficiente de un medio'], senales };
  return { nivel: 4, etiqueta: 'Descartado por el algoritmo', confianza: 0, razones: ['Sin señales específicas suficientes'], senales: [] };
}
export function pareceContenidoDePrensa(descripcion: string | null | undefined): boolean { return clasificarContenidoPrensa(descripcion).nivel < 4; }
