import { createHash } from 'node:crypto';

import * as XLSX from 'xlsx';

/**
 * Lectura de los libros del Portal de Transparencia.
 *
 * Se usa SheetJS (`xlsx`) y NO ExcelJS: el archivo real es `.xls` legacy
 * (BIFF8) y ExcelJS solo soporta `.xlsx`/`.csv`. SheetJS lee BIFF8, `.xlsx` y
 * `.csv` por la misma vía, así que no hace falta una etapa de conversión.
 */

export type RawSheet = {
  /** Hoja de la que se leyeron los datos. */
  sheetName: string;
  /** Títulos anteriores al encabezado, sin mezclar descripciones de órdenes. */
  titleRows?: unknown[][];
  /** Todas las hojas del libro (para poder avisar si hay más de una). */
  sheetNames: string[];
  /** Índice (0-based) de la fila que se detectó como encabezado. */
  headerRowIndex: number;
  /** Encabezados tal como aparecen en el archivo, sin recortar ni renombrar. */
  headers: string[];
  /** Filas de datos alineadas con `headers`. Puede haber celdas vacías. */
  rows: unknown[][];
  /** Fila física (1-based), incluso si había huecos en la hoja. */
  sourceRows: number[];
  /** Filas descartadas por estar completamente vacías. */
  blankRowsSkipped: number;
};

export type ParseOptions = {
  /** Hoja concreta a leer. Por defecto, la primera. */
  sheetName?: string;
  /** Cuántas filas iniciales se inspeccionan buscando el encabezado. */
  headerScanLimit?: number;
};

/**
 * Huella SHA-256 del archivo. Se usa para detectar que el mismo libro ya se
 * importó antes, sin tener que comparar fila por fila (sección 8 del pliego).
 */
export function computeChecksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Detecta la fila de encabezado: la que tiene más celdas no vacías entre las
 * primeras filas. Los libros del portal a veces traen títulos o logos arriba.
 */
export function detectHeaderRowIndex(rows: unknown[][], scanLimit = 15): number {
  let mejorIndice = 0;
  let mejorCuenta = -1;

  const limite = Math.min(rows.length, scanLimit);
  for (let i = 0; i < limite; i++) {
    const fila = rows[i];
    if (!fila) continue;
    const cuenta = fila.filter((c) => c !== null && c !== undefined && c !== '').length;
    if (cuenta > mejorCuenta) {
      mejorCuenta = cuenta;
      mejorIndice = i;
    }
  }

  return mejorIndice;
}

function esCeldaVacia(celda: unknown): boolean {
  return celda === null || celda === undefined || celda === '';
}

function filaVacia(fila: unknown[]): boolean {
  return fila.every(esCeldaVacia);
}

/**
 * Convierte el contenido de un libro en una estructura plana.
 *
 * `cellDates: true` hace que las celdas de fecha reales (en `.xlsx`) lleguen
 * como `Date`; las de texto llegan como cadena y las resuelve
 * `services/normalization.ts`.
 */
export function parseSpreadsheet(buffer: Buffer, options: ParseOptions = {}): RawSheet {
  const { sheetName, headerScanLimit = 15 } = options;

  const workbook = XLSX.read(buffer, { cellDates: true, raw: true });

  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) {
    throw new Error('El archivo no contiene ninguna hoja de cálculo.');
  }

  const elegida = sheetName ?? sheetNames[0];
  const worksheet = workbook.Sheets[elegida];
  if (!worksheet) {
    throw new Error(`La hoja "${elegida}" no existe en el archivo.`);
  }

  // `blankrows: true` para que los índices de fila se correspondan con el
  // archivo original; se descartan después, contabilizándolos.
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
    range: 0,
  });

  if (matriz.length === 0) {
    throw new Error('La hoja está vacía.');
  }

  const headerRowIndex = detectHeaderRowIndex(matriz, headerScanLimit);
  const filaEncabezado = matriz[headerRowIndex] ?? [];

  const headers = filaEncabezado.map((c) => (c === null || c === undefined ? '' : String(c).trim()));

  const rows: unknown[][] = [];
  const sourceRows: number[] = [];
  let blankRowsSkipped = 0;

  for (let i = headerRowIndex + 1; i < matriz.length; i++) {
    const fila = matriz[i] ?? [];
    if (filaVacia(fila)) {
      blankRowsSkipped++;
      continue;
    }
    // Se normaliza la longitud para que todas las filas tengan tantas celdas
    // como encabezados; así `fila[i]` siempre corresponde a `headers[i]`.
    // Una celda vacía del origen puede llegar como cadena vacía o como celda
    // ausente: se unifica a null para que "sin valor" tenga una sola
    // representación en todo el importador.
    const alineada = headers.map((_, idx) => {
      const valor = idx < fila.length ? fila[idx] : null;
      return valor === '' ? null : valor;
    });
    rows.push(alineada);
    sourceRows.push(i + 1);
  }

  return {
    sheetName: elegida,
    titleRows: matriz.slice(0, headerRowIndex),
    sheetNames,
    headerRowIndex,
    headers,
    rows,
    sourceRows,
    blankRowsSkipped,
  };
}

/** Valor de celda garantizado como JSON seguro. */
export type RawCellValue = string | number | boolean | null;

/** Registro original de una fila, listo para la columna `Json` de Prisma. */
export type RawRecord = Record<string, RawCellValue>;

/** Convierte cualquier celda a un valor JSON seguro, sin perder información. */
function aValorJson(valor: unknown): RawCellValue {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') {
    return valor;
  }
  // Cualquier otra cosa (objeto, símbolo) se representa como texto en lugar de
  // almacenarse tal cual en la columna JSON.
  return String(valor);
}

/**
 * Convierte una fila en un objeto `{ encabezado: valor }`.
 *
 * Esto es lo que se guarda en `Order.rawData`: la representación ORIGINAL del
 * registro, sin normalizar, para que cualquier dato mostrado pueda rastrearse
 * hasta el archivo fuente (sección 44).
 */
export function rowToRawObject(headers: string[], fila: unknown[]): RawRecord {
  const objeto: RawRecord = {};
  headers.forEach((encabezado, idx) => {
    if (encabezado === '') return;
    const valor = idx < fila.length ? fila[idx] : null;
    objeto[encabezado] = aValorJson(valor);
  });
  return objeto;
}
