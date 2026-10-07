export const MESES_SEACE = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'] as const;
export type MesSeace = { mes: number; estado: 'pendiente' | 'descargado' | 'error'; archivo?: string; bytes?: number; sha256?: string; detalle?: string };
export type DescargaSeace = { id: string; anio: number; ruc: string; municipio: string; creado: number; meses: MesSeace[] };
