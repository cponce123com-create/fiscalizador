export const MUNICIPALIDAD_DEFAULT_ID = 'mun-san-ramon';
export const MUNICIPALIDAD_DEFAULT_SLUG = 'san-ramon';

export type MunicipalidadActiva = {
  id: string;
  slug: string;
  nombre: string;
  nombreCorto: string;
  ruc: string;
  provincia: string;
  departamento: string;
  tipoEntidad: string;
  /** Categoría general; opcional en contratos legacy para no romper consumidores existentes. */
  categoria?: string;
};
