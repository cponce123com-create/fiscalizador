import listado from '@/data/prensa.json';
import { dniDesdeRuc } from '@/lib/supplier-profile';

/** Listado aportado para consulta: sin cifras del artículo ni vínculos societarios. */
export const catalogoPrensa = listado.map(fila => ({ ...fila, dni: dniDesdeRuc(fila.ruc) }));

export type ContratacionPrensa = {
  ruc: string;
  nombre: string;
  nombreListado: string;
  tipo: 'Persona natural' | 'Empresa';
  ordenes: number;
  anuladas: number;
  registrado: string;
  anulado: string;
  considerado: string;
  primera: string | null;
  ultima: string | null;
  fotoUrl: string | null;
  perfilUrl: string;
};

export type ResumenPrensa = {
  filas: ContratacionPrensa[];
  conOrdenes: number;
  ordenes: number;
  considerado: string;
};

/** Orden editorial solicitado, por identidad contractual y no por coincidencia de nombre. */
export const prioridadPrensa = [
  '10199270040', // Benigno Palacios Aguilar
  '10454761923', // Mariella Galarza Villar
  '10205368669', // Oscar Alfonso Esteban De La Cruz
  '10457032311', // Juan Jesús Tineo Baldeón
  '10435680718', // Elías Eleazar Samaniego Lanasca
  '10421623657', // Johnny Wildo Huaynates Montalvo
  '10211377050', // Genaro Elías Poma Medina
] as const;
export function posicionPrensa(ruc: string): number {
  const posicion = prioridadPrensa.findIndex(id => id === ruc);
  return posicion < 0 ? prioridadPrensa.length : posicion;
}
