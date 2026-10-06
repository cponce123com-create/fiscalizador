/**
 * Normalización y parseo de los valores que llegan en los libros del Portal de
 * Transparencia.
 *
 * Todo lo de este módulo son funciones PURAS: no tocan la base de datos ni el
 * sistema de archivos. Eso las hace directamente testeables y es lo que permite
 * verificar los hallazgos del archivo real (docs/reference/FORMATOS.md).
 *
 * Formatos confirmados sobre `docs/reference/Lista-OCOS-2023-06.xls`:
 *   - Las 12 columnas llegan como TEXTO, sin celdas numéricas ni de fecha.
 *   - Fecha:  "2023-06-06 00:00:00.0"  (ISO con hora, como cadena)
 *   - Monto:  "S/. 650", "S/. 14769.5" (prefijo "S/.", punto decimal)
 *   - RUC:    "20541487710"            (11 dígitos, siempre presente)
 *   - Estado: "Devengada" | "Anulada"
 */

export type SupplierTypeValue =
  | 'PERSONA_NATURAL'
  | 'PERSONA_JURIDICA'
  | 'OTRO'
  | 'DESCONOCIDO';

export type Problem = 'VACIO' | 'FORMATO' | 'AMBIGUA' | 'FUERA_DE_RANGO' | null;

export type ParsedAmount = {
  /** Valor listo para `Prisma.Decimal`, o null si no es interpretable. */
  value: string | null;
  /** Texto original, preservado tal cual para `rawData` y la auditoría. */
  raw: string;
  problem: Problem;
};

export type ParsedDate = {
  /** Fecha a medianoche UTC, o null si no es interpretable. */
  value: Date | null;
  raw: string;
  problem: Problem;
};

export type ParsedRuc = {
  /** 11 dígitos, o null si el formato es inválido. */
  value: string | null;
  raw: string;
  problem: Problem;
  /** El dígito verificador (módulo 11) coincide. */
  checkDigitValid: boolean;
};

// =============================================================================
// TEXTO
// =============================================================================

/**
 * Elimina diacríticos conservando el resto de caracteres.
 * "JUNÍN" -> "JUNIN", "Contratación" -> "Contratacion".
 */
export function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Clave de comparación para encabezados, estados y tipos.
 *
 * Minúsculas, sin diacríticos, sin puntuación y con espacios colapsados. Es la
 * forma en la que se guardan los `aliases` de los catálogos, de modo que
 * "Devengada", "DEVENGADA" y "devengada " colisionan en la misma clave.
 */
export function normalizeKey(value: string): string {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Nombre canónico de proveedor para agrupar y comparar.
 *
 * NO elimina sufijos societarios (S.A.C., E.I.R.L., ...) a propósito: la
 * sección 10 del pliego exige DETECTAR variaciones y dejarlas en revisión, no
 * fusionarlas. Quitar sufijos aumentaría los falsos positivos.
 */
export function normalizeSupplierName(value: string): string {
  return stripDiacritics(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Slug estable para URLs amigables (`/proveedores/molineraselva`). */
export function slugify(value: string): string {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Convierte cualquier valor de celda a texto, tratando null/undefined como ''. */
export function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

// =============================================================================
// MONTO
// =============================================================================

const PREFIJOS_MONEDA = ['s/.', 's/', 's.', 'pen', 'usd', '$', '€'];

/**
 * Parsea un monto del libro.
 *
 * Convención `es-PE`: la coma separa miles y el punto decimales. En el archivo
 * real no aparece ninguna coma, pero se contempla porque los libros de otros
 * meses pueden traerlas.
 *
 * Devuelve el valor como CADENA decimal (no como `number`) para no introducir
 * error de coma flotante antes de llegar a `Decimal(14,2)`.
 */
export function parseAmount(input: unknown): ParsedAmount {
  const raw = toText(input);
  let s = raw.trim();

  if (s === '') return { value: null, raw, problem: 'VACIO' };

  const lower = s.toLowerCase();
  for (const prefijo of PREFIJOS_MONEDA) {
    if (lower.startsWith(prefijo)) {
      s = s.slice(prefijo.length);
      break;
    }
  }

  // Espacios normales, no separables y de distinto ancho.
  s = s.replace(/[\s\u00A0\u202F]/g, '');

  if (s === '') return { value: null, raw, problem: 'FORMATO' };

  const tieneComa = s.includes(',');
  const tienePunto = s.includes('.');

  if (tieneComa && tienePunto) {
    // "1.234,56" o "1,234.56": el separador decimal es el que aparece más a la
    // derecha; el otro es de miles.
    const ultimaComa = s.lastIndexOf(',');
    const ultimoPunto = s.lastIndexOf('.');
    if (ultimaComa > ultimoPunto) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (tieneComa) {
    // "1,234" (miles) vs "1234,5" (decimal).
    if (/^[0-9]{1,3}(,[0-9]{3})+$/.test(s)) {
      s = s.replace(/,/g, '');
    } else if (/^[0-9]+,[0-9]{1,2}$/.test(s)) {
      s = s.replace(',', '.');
    } else {
      return { value: null, raw, problem: 'FORMATO' };
    }
  } else if (tienePunto) {
    // Varios puntos solo pueden ser separadores de miles.
    if (/^[0-9]{1,3}(\.[0-9]{3})+$/.test(s)) {
      s = s.replace(/\./g, '');
    } else if (!/^[0-9]+(\.[0-9]+)?$/.test(s)) {
      return { value: null, raw, problem: 'FORMATO' };
    }
  }

  if (!/^[0-9]+(\.[0-9]+)?$/.test(s)) {
    return { value: null, raw, problem: 'FORMATO' };
  }

  const [entero, decimales = ''] = s.split('.');
  const normalizado = `${entero}.${(decimales + '00').slice(0, 2)}`;

  // Decimal(14,2) admite hasta 12 dígitos enteros.
  if (entero.replace(/^0+/, '').length > 12) {
    return { value: null, raw, problem: 'FUERA_DE_RANGO' };
  }

  return { value: normalizado, raw, problem: null };
}

// =============================================================================
// FECHA
// =============================================================================

const RE_ISO = /^([0-9]{4})-([0-9]{2})-([0-9]{2})(?:[ T]([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.[0-9]+)?)?$/;
const RE_DMA = /^([0-9]{1,2})[/-]([0-9]{1,2})[/-]([0-9]{4})$/;

/**
 * Parsea una fecha del libro.
 *
 * Se aceptan las dos formas observadas en los portales:
 *   - ISO con hora:  "2023-06-06 00:00:00.0"  (la del archivo real)
 *   - Día/mes/año:   "06/06/2023"
 *
 * El resultado es SIEMPRE medianoche UTC. Las columnas son `@db.Date`, así que
 * construir la fecha con la zona horaria local desplazaría el día según el
 * huso del servidor.
 */
export function parseDate(input: unknown): ParsedDate {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      return { value: null, raw: input.toISOString(), problem: 'FORMATO' };
    }
    return {
      value: new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate())),
      raw: input.toISOString(),
      problem: null,
    };
  }

  const raw = toText(input);
  const s = raw.trim();
  if (s === '') return { value: null, raw, problem: 'VACIO' };

  let year: number;
  let month: number;
  let day: number;
  let ambigua = false;

  const iso = RE_ISO.exec(s);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else {
    const dma = RE_DMA.exec(s);
    if (!dma) return { value: null, raw, problem: 'FORMATO' };

    const a = Number(dma[1]);
    const b = Number(dma[2]);
    year = Number(dma[3]);

    // Convención del portal: día primero (dd/mm/yyyy). El primer número es
    // siempre el día; solo se marca ambigüedad cuando ambos podrían ser un mes.
    day = a;
    month = b;
    if (a <= 12 && b <= 12 && a !== b) ambigua = true;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { value: null, raw, problem: 'FUERA_DE_RANGO' };
  }

  const fecha = new Date(Date.UTC(year, month - 1, day));
  // Rechaza fechas inexistentes como 2023-02-30, que Date "corregiría" sola.
  if (
    fecha.getUTCFullYear() !== year ||
    fecha.getUTCMonth() !== month - 1 ||
    fecha.getUTCDate() !== day
  ) {
    return { value: null, raw, problem: 'FUERA_DE_RANGO' };
  }

  return { value: fecha, raw, problem: ambigua ? 'AMBIGUA' : null };
}

// =============================================================================
// RUC
// =============================================================================

const PESOS_RUC = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/**
 * Valida el dígito verificador del RUC peruano (módulo 11).
 *
 * Se calcula sobre los 10 primeros dígitos y se compara con el undécimo.
 * Un dígito verificador incorrecto NO invalida el registro: se conserva y se
 * reporta como advertencia, porque puede tratarse de un error del archivo
 * fuente y el dato original nunca debe alterarse (sección 44).
 */
export function isValidRucCheckDigit(ruc: string): boolean {
  if (!/^[0-9]{11}$/.test(ruc)) return false;

  let suma = 0;
  for (let i = 0; i < 10; i++) {
    suma += Number(ruc[i]) * PESOS_RUC[i];
  }

  const resto = suma % 11;
  // Regla peruana: digito = 11 - resto. Si da 10 se usa 0; si da 11 se usa 1.
  const bruto = 11 - resto;
  const digitoCalculado = bruto === 10 ? 0 : bruto === 11 ? 1 : bruto;
  return digitoCalculado === Number(ruc[10]);
}

/** Parsea y valida un RUC. Formato inválido => `value: null` + ERROR. */
export function parseRuc(input: unknown): ParsedRuc {
  const raw = toText(input);
  // Los libros a veces exportan el RUC con guiones ("20-54148771-0") o con
  // espacios; se limpian antes de validar, pero `raw` conserva el original.
  const limpio = raw.replace(/[^0-9]/g, '');

  if (raw.trim() === '') {
    return { value: null, raw, problem: 'VACIO', checkDigitValid: false };
  }

  if (!/^[0-9]{11}$/.test(limpio)) {
    return { value: null, raw, problem: 'FORMATO', checkDigitValid: false };
  }

  return {
    value: limpio,
    raw,
    problem: null,
    checkDigitValid: isValidRucCheckDigit(limpio),
  };
}

/**
 * Tipo de proveedor a partir del prefijo del RUC.
 *
 * El prefijo es una heurística, no una verdad: si no es 10 ni 20 se devuelve
 * OTRO en lugar de forzar una clasificación incorrecta.
 */
export function inferSupplierType(ruc: string): SupplierTypeValue {
  if (ruc.startsWith('10')) return 'PERSONA_NATURAL';
  if (ruc.startsWith('20')) return 'PERSONA_JURIDICA';
  if (/^[0-9]{11}$/.test(ruc)) return 'OTRO';
  return 'DESCONOCIDO';
}

// =============================================================================
// DEDUPLICACIÓN
// =============================================================================

/**
 * Clave de deduplicación de una orden: número + RUC + monto + fecha.
 *
 * Se usa para detectar reimportaciones del mismo periodo y duplicados dentro de
 * un mismo lote. En el archivo real ya hay dos números de orden repetidos
 * (238 y 245), así que la detección NO es hipotética.
 */
export function buildDedupeKey(partes: {
  orderNumber: string;
  orderType?: string | null;
  ruc: string;
  amount: string | null;
  issueDate: Date | null;
}): string {
  const fecha = partes.issueDate ? partes.issueDate.toISOString().slice(0, 10) : '';
  return [
    normalizeKey(partes.orderType ?? ''),
    normalizeKey(partes.orderNumber),
    partes.ruc,
    partes.amount ?? '',
    fecha,
  ].join('|');
}
