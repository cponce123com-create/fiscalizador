/** Categorías de entidades contratantes; no confundir con su nivel territorial. */
export const CATEGORIAS_ENTIDAD_PUBLICA = [
  { id: 'MUNICIPALIDAD', nombre: 'Municipalidad' },
  { id: 'GOBIERNO_REGIONAL', nombre: 'Gobierno regional' },
  { id: 'GOBIERNO_NACIONAL', nombre: 'Entidad del gobierno nacional' },
  { id: 'EDUCACION', nombre: 'Educación (UGEL y otras)' },
  { id: 'SALUD', nombre: 'Salud (redes, hospitales y otras)' },
  { id: 'EMPRESA_PUBLICA', nombre: 'Empresa pública (EPS y otras)' },
  { id: 'PROYECTO_ESPECIAL', nombre: 'Proyecto especial' },
  { id: 'UNIVERSIDAD', nombre: 'Universidad' },
  { id: 'OTRO', nombre: 'Otra entidad pública' },
] as const;

export type CategoriaEntidadPublica = (typeof CATEGORIAS_ENTIDAD_PUBLICA)[number]['id'];

export function nombreCategoriaEntidadPublica(id: string): string {
  return CATEGORIAS_ENTIDAD_PUBLICA.find((categoria) => categoria.id === id)?.nombre ?? 'Otra entidad pública';
}
