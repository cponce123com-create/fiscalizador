export const MESES_SEACE = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'] as const;
export const RUC_SEACE = '20146657142';
export const MUNICIPIO_SEACE = 'Municipalidad Distrital de San Ramón';
const BASE = 'https://prod2.seace.gob.pe/seacebus-uiwd-pub/buscadorPublico/ongei/buscadorPublicoOCOS.xhtml';

/** Solo genera las consultas oficiales. No descarga ni modifica los libros. */
export function enlacesAnualesSeace(anio: number, ruc = RUC_SEACE, anioActual = new Date().getFullYear()) {
  if (!Number.isInteger(anio) || anio < 2000 || anio > anioActual || !/^\d{11}$/.test(ruc)) {
    throw new Error('Selecciona un año válido y el RUC de once dígitos de la entidad.');
  }
  return MESES_SEACE.map((nombre, indice) => {
    const mes = indice + 1;
    const params = new URLSearchParams({ ruc_entidad: ruc, anio: String(anio), mes: String(mes).padStart(2, '0'), theme: 'ongei' });
    return { mes, nombre, url: `${BASE}?${params}` };
  });
}
