/** Política compartida para recuperar importaciones interrumpidas. */
export const PROCESO_CADUCADO_MS = 10 * 60 * 1000;
export function procesoCaducado(iniciadoEn: Date | null, ahora: Date): boolean {
  return !iniciadoEn || ahora.getTime() - iniciadoEn.getTime() > PROCESO_CADUCADO_MS;
}
