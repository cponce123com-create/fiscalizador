import { prisma } from '@/lib/prisma';
/** No publica columnas arbitrarias del libro ni datos internos del administrador. */
export async function camposOcultos(batchId: string | string[]): Promise<Set<string>> {
  const [globales, locales] = await Promise.all([
    prisma.columnVisibility.findMany({
      where: { isPublic: false },
      select: { internalField: true },
    }),
    prisma.importColumn.findMany({
      where: {
        importBatchId: { in: Array.isArray(batchId) ? batchId : [batchId] },
        isPublic: false,
      },
      select: { internalField: true },
    }),
  ]);
  return new Set(
    [...globales, ...locales].flatMap((c) => (c.internalField ? [c.internalField] : [])),
  );
}
export function celdaCsv(valor: unknown): string {
  let texto = valor == null ? '' : String(valor);
  if (/^[\s]*[=+@-]/.test(texto) || /^[\t\r\n]/.test(texto)) texto = "'" + texto;
  return '"' + texto.replaceAll('"', '""') + '"';
}
