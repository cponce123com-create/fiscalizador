/** Señales de revisión, no límites legales ni pruebas de sobrevaloración. */
export const MONTO_ALTO_SOLES = 2_000_000;
export const MONTO_ATIPICO_MINIMO_SOLES = 100_000;
export const FACTOR_MONTO_ATIPICO = 50;

export function requiereRevisionMonto(issues: readonly { code: string }[]): boolean {
  return issues.some(issue => ['MONTO_ALTO', 'MONTO_ATIPICO', 'MONTO_COINCIDE_RUC'].includes(issue.code));
}

export type MontoPorFila = {
  sourceRow: number;
  registeredCents: number;
  cancelledCents: number;
};

/** Descuenta también las filas fuera de la vista previa (limitada a 500). */
export function resumenConExclusiones<T extends {
  registeredCents: number; cancelledCents: number; consideredCents: number;
}>(summary: T, filas: readonly MontoPorFila[], excluidas: ReadonlySet<number>): T {
  let registeredCents = summary.registeredCents;
  let cancelledCents = summary.cancelledCents;
  for (const fila of filas) {
    if (!excluidas.has(fila.sourceRow)) continue;
    registeredCents -= fila.registeredCents;
    cancelledCents -= fila.cancelledCents;
  }
  return { ...summary, registeredCents, cancelledCents, consideredCents: registeredCents - cancelledCents };
}
