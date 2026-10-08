import { parentPort, workerData } from 'node:worker_threads';

import * as XLSX from 'xlsx';

function detectHeaderRowIndex(rows, scanLimit = 15) {
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

function filaVacia(fila) {
  return fila.every((celda) => celda === null || celda === undefined || celda === '');
}

function parseSpreadsheet(buffer, options = {}) {
  const { sheetName, headerScanLimit = 15 } = options;
  const workbook = XLSX.read(buffer, { cellDates: true, raw: true });
  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) throw new Error('El archivo no contiene ninguna hoja de cálculo.');
  const elegida = sheetName ?? sheetNames[0];
  const worksheet = workbook.Sheets[elegida];
  if (!worksheet) throw new Error(`La hoja "${elegida}" no existe en el archivo.`);
  const matriz = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: null, blankrows: true, range: 0 });
  if (matriz.length === 0) throw new Error('La hoja está vacía.');
  const headerRowIndex = detectHeaderRowIndex(matriz, headerScanLimit);
  const filaEncabezado = matriz[headerRowIndex] ?? [];
  const headers = filaEncabezado.map((c) => (c === null || c === undefined ? '' : String(c).trim()));
  const rows = [];
  const sourceRows = [];
  let blankRowsSkipped = 0;
  for (let i = headerRowIndex + 1; i < matriz.length; i++) {
    const fila = matriz[i] ?? [];
    if (filaVacia(fila)) {
      blankRowsSkipped++;
      continue;
    }
    rows.push(headers.map((_, idx) => {
      const valor = idx < fila.length ? fila[idx] : null;
      return valor === '' ? null : valor;
    }));
    sourceRows.push(i + 1);
  }
  return { sheetName: elegida, titleRows: matriz.slice(0, headerRowIndex), sheetNames, headerRowIndex, headers, rows, sourceRows, blankRowsSkipped };
}

try {
  parentPort?.postMessage({ ok: true, hoja: parseSpreadsheet(Buffer.from(workerData.buffer), workerData.options) });
} catch (error) {
  parentPort?.postMessage({ ok: false, error: error instanceof Error ? error.message : 'No se pudo leer el libro.' });
}
