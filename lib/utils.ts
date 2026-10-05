import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Combina clases resolviendo conflictos de Tailwind (la última gana). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const FORMATO_MONEDA = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formatea un monto en soles.
 *
 * Los montos llegan como CADENA desde la API y desde Prisma: son `Decimal`, no
 * `number`. Convertirlos a `number` para formatear es aceptable aquí (solo es
 * presentación), pero nunca debe hacerse para calcular.
 */
export function formatearMonto(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—';

  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero)) return '—';

  return FORMATO_MONEDA.format(numero);
}

/** Formatea centavos enteros (lo que devuelve la validación) como soles. */
export function formatearCentavos(centavos: number): string {
  return FORMATO_MONEDA.format(centavos / 100);
}

/**
 * Formatea una fecha en formato peruano.
 *
 * Se fija la zona a UTC a propósito: las fechas de emisión y compromiso son
 * columnas `@db.Date` y se guardan a medianoche UTC. Formatearlas en la zona
 * local mostraría el día anterior en cualquier huso negativo, como el de Perú.
 */
export function formatearFecha(valor: Date | string | null | undefined): string {
  if (!valor) return '—';

  const fecha = typeof valor === 'string' ? new Date(valor) : valor;
  if (Number.isNaN(fecha.getTime())) return '—';

  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(fecha);
}

/** Formatea una marca de tiempo (creación, procesamiento) en hora local. */
export function formatearFechaHora(valor: Date | string | null | undefined): string {
  if (!valor) return '—';

  const fecha = typeof valor === 'string' ? new Date(valor) : valor;
  if (Number.isNaN(fecha.getTime())) return '—';

  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(fecha);
}

/** Nombre del mes en español, para los selectores del asistente. */
export const MESES: readonly { valor: number; nombre: string }[] = [
  { valor: 1, nombre: 'Enero' },
  { valor: 2, nombre: 'Febrero' },
  { valor: 3, nombre: 'Marzo' },
  { valor: 4, nombre: 'Abril' },
  { valor: 5, nombre: 'Mayo' },
  { valor: 6, nombre: 'Junio' },
  { valor: 7, nombre: 'Julio' },
  { valor: 8, nombre: 'Agosto' },
  { valor: 9, nombre: 'Setiembre' },
  { valor: 10, nombre: 'Octubre' },
  { valor: 11, nombre: 'Noviembre' },
  { valor: 12, nombre: 'Diciembre' },
];

/** Etiquetas legibles para los estados de una importación. */
export const ETIQUETAS_ESTADO_IMPORTACION: Record<string, string> = {
  UPLOADED: 'Subido',
  VALIDATING: 'Validado, sin confirmar',
  PROCESSING: 'Procesando',
  COMPLETED: 'Completado',
  COMPLETED_WITH_WARNINGS: 'Completado con advertencias',
  FAILED: 'Fallido',
};

/** Etiquetas legibles para el tipo de información de un lote. */
export const ETIQUETAS_TIPO_IMPORTACION: Record<string, string> = {
  ORDENES_COMPRA: 'Órdenes de compra',
  ORDENES_SERVICIO: 'Órdenes de servicio',
  CONSOLIDADO: 'Consolidado',
};
