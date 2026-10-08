/** La lista llega ordenada de más reciente a más antigua, solo con datos publicados. */
export function seleccionarPeriodoRanking(valor: string | string[] | undefined, periodos: { id: string }[]): string {
  const solicitado = Array.isArray(valor) ? valor[0] : valor;
  if (solicitado === 'todas') return 'todas';
  if (periodos.some(periodo => periodo.id === solicitado)) return solicitado!;
  return periodos[0]?.id ?? 'todas';
}
