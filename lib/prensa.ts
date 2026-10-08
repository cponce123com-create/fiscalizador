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
