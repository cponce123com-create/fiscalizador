import { Prisma } from '@/lib/generated/prisma/client';

/** Formatea agregados monetarios sin convertirlos a coma flotante. */
export function decimalMonetario(valor: unknown): string {
  if (valor === null || valor === undefined) return '0.00';
  try {
    const decimal = new Prisma.Decimal(String(valor));
    return decimal.isFinite() ? decimal.toFixed(2) : '0.00';
  } catch {
    return '0.00';
  }
}
