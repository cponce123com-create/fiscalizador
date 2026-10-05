import { readFileSync } from 'node:fs';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  computeChecksum,
  parseSpreadsheet,
  rowToRawObject,
  type RawSheet,
} from '@/services/parseService';
import { parseAmount, parseDate, parseRuc, isValidRucCheckDigit } from '@/services/normalization';

/**
 * Prueba de integración contra el LIBRO REAL del Portal de Transparencia.
 *
 * Los valores esperados NO son inventados: se obtuvieron inspeccionando
 * `docs/reference/Lista-OCOS-2023-06.xls` durante el Paso 0 del plan. Si el
 * importador empieza a producir cifras distintas, esta prueba lo detecta.
 *
 * Los totales se comprueban en CENTAVOS (enteros) para no arrastrar el error de
 * coma flotante que precisamente se quiere evitar usando Decimal(14,2).
 */

const RUTA_ARCHIVO = path.join(process.cwd(), 'docs', 'reference', 'Lista-OCOS-2023-06.xls');

const ENCABEZADOS_ESPERADOS = [
  'N°',
  'Tipo de Orden',
  'Número de orden',
  'Tipo de Contratación',
  'Descripción y Finalidad de la contratación',
  'Nro. Exp. SIAF',
  'Fecha de Emisión',
  'Fecha de Compromiso',
  'Estado',
  'Monto',
  'RUC',
  'Denominación o razón Social',
];

// Cifras de control del Paso 0.
const TOTAL_REGISTRADO_CENTAVOS = 106613659; // S/ 1,066,136.59
const TOTAL_ANULADO_CENTAVOS = 3899487; // S/    38,994.87
const TOTAL_CONSIDERADO_CENTAVOS = 102714172; // S/ 1,027,141.72

/** Convierte "14769.50" a 1476950 centavos, sin pasar por coma flotante. */
function aCentavos(valorDecimal: string): number {
  const [entero, decimales = '00'] = valorDecimal.split('.');
  return Number(entero) * 100 + Number(decimales.padEnd(2, '0').slice(0, 2));
}

describe('parseService contra el archivo real (Lista-OCOS-2023-06.xls)', () => {
  let buffer: Buffer;
  let hoja: RawSheet;
  let col: Record<string, number>;

  beforeAll(() => {
    buffer = readFileSync(RUTA_ARCHIVO);
    hoja = parseSpreadsheet(buffer);
    col = {};
    hoja.headers.forEach((h, i) => {
      col[h] = i;
    });
  });

  it('lee el libro BIFF8 legacy con SheetJS', () => {
    // ExcelJS no puede leer este formato; si esto pasa, la elección de
    // librería está justificada de verdad.
    expect(hoja.sheetNames).toEqual(['Sheet0']);
    expect(hoja.sheetName).toBe('Sheet0');
  });

  it('detecta el encabezado en la primera fila y respeta los nombres originales', () => {
    expect(hoja.headerRowIndex).toBe(0);
    expect(hoja.headers).toEqual(ENCABEZADOS_ESPERADOS);
  });

  it('lee las 103 filas de datos sin descartar ninguna', () => {
    expect(hoja.rows).toHaveLength(103);
    expect(hoja.blankRowsSkipped).toBe(0);
  });

  it('todas las filas tienen tantas celdas como encabezados', () => {
    for (const fila of hoja.rows) {
      expect(fila).toHaveLength(ENCABEZADOS_ESPERADOS.length);
    }
  });

  it('los montos suman exactamente las cifras de control', () => {
    let registrado = 0;
    let anulado = 0;

    for (const fila of hoja.rows) {
      const monto = parseAmount(fila[col['Monto']]);
      expect(monto.problem, `monto ilegible: ${monto.raw}`).toBeNull();

      const centavos = aCentavos(monto.value as string);
      registrado += centavos;

      if (String(fila[col['Estado']]).trim() !== 'Devengada') {
        anulado += centavos;
      }
    }

    expect(registrado).toBe(TOTAL_REGISTRADO_CENTAVOS);
    expect(anulado).toBe(TOTAL_ANULADO_CENTAVOS);
    // El monto considerado excluye las órdenes anuladas (secciones 14 y 46).
    expect(registrado - anulado).toBe(TOTAL_CONSIDERADO_CENTAVOS);
  });

  it('detecta la única orden anulada y su fila incompleta', () => {
    const anuladas = hoja.rows.filter((f) => String(f[col['Estado']]).trim() === 'Anulada');

    expect(anuladas).toHaveLength(1);
    const fila = anuladas[0] as unknown[];

    expect(String(fila[col['Número de orden']])).toBe('245');
    expect(String(fila[col['Denominación o razón Social']])).toBe('INVERSIONES URRUCHI S.A.C.');
    expect(parseAmount(fila[col['Monto']]).value).toBe('38994.87');

    // Es la única fila del libro con SIAF y fecha de compromiso vacíos.
    expect(fila[col['Nro. Exp. SIAF']]).toBeNull();
    expect(parseDate(fila[col['Fecha de Compromiso']]).problem).toBe('VACIO');
  });

  it('cuenta 102 devengadas y 1 anulada', () => {
    const conteo = new Map<string, number>();
    for (const fila of hoja.rows) {
      const estado = String(fila[col['Estado']]).trim();
      conteo.set(estado, (conteo.get(estado) ?? 0) + 1);
    }

    expect(Object.fromEntries(conteo)).toEqual({ Devengada: 102, Anulada: 1 });
  });

  it('todos los RUC del archivo pasan el dígito verificador', () => {
    const rucs = new Set<string>();

    for (const fila of hoja.rows) {
      const ruc = parseRuc(fila[col['RUC']]);
      expect(ruc.problem, `RUC ilegible: ${ruc.raw}`).toBeNull();
      expect(ruc.checkDigitValid, `RUC con dígito verificador inválido: ${ruc.raw}`).toBe(true);
      expect(ruc.value).toHaveLength(11);
      rucs.add(ruc.value as string);
    }

    // 103 filas repartidas entre 72 proveedores distintos.
    expect(rucs.size).toBe(72);
  });

  it('reparte los RUC entre 66 de persona natural y 37 de persona jurídica', () => {
    let ruc10 = 0;
    let ruc20 = 0;

    for (const fila of hoja.rows) {
      const ruc = parseRuc(fila[col['RUC']]).value as string;
      if (ruc.startsWith('10')) ruc10++;
      else if (ruc.startsWith('20')) ruc20++;
    }

    expect(ruc10).toBe(66);
    expect(ruc20).toBe(37);
    expect(ruc10 + ruc20).toBe(103);
  });

  it('encuentra los dos números de orden duplicados del archivo', () => {
    // Los duplicados son reales (238 y 245), no un supuesto de diseño.
    const conteo = new Map<string, number>();
    for (const fila of hoja.rows) {
      const nro = String(fila[col['Número de orden']]).trim();
      conteo.set(nro, (conteo.get(nro) ?? 0) + 1);
    }

    const duplicados = [...conteo.entries()].filter(([, n]) => n > 1).map(([nro]) => nro).sort();

    expect(conteo.size).toBe(101);
    expect(duplicados).toEqual(['238', '245']);
  });

  it('parsea las fechas ISO con hora del archivo', () => {
    const primera = hoja.rows[0] as unknown[];
    expect(parseDate(primera[col['Fecha de Emisión']]).value?.toISOString()).toBe(
      '2023-06-06T00:00:00.000Z',
    );

    for (const fila of hoja.rows) {
      const emision = parseDate(fila[col['Fecha de Emisión']]);
      expect(emision.value, `fecha de emisión ilegible: ${emision.raw}`).not.toBeNull();
      expect(emision.problem).toBeNull();
    }
  });

  it('preserva el registro original íntegro en rawData', () => {
    const primera = hoja.rows[0] as unknown[];
    const raw = rowToRawObject(hoja.headers, primera);

    // Se conserva el texto tal cual, incluidos el prefijo "S/." y el formato
    // de fecha con hora: la normalización es una proyección, no un reemplazo.
    expect(raw['Monto']).toBe('S/. 650');
    expect(raw['Fecha de Emisión']).toBe('2023-06-06 00:00:00.0');
    expect(raw['RUC']).toBe('20541487710');
    expect(raw['N°']).toBe('1');
    expect(Object.keys(raw)).toHaveLength(12);
  });

  it('no altera el contenido con caracteres defectuosos del origen', () => {
    // El libro trae 18 descripciones con U+00BF donde el origen debía tener un
    // guion. Se conservan: corregirlas en silencio sería falsear el dato.
    const conInvertido = hoja.rows.filter((f) =>
      String(f[col['Descripción y Finalidad de la contratación']] ?? '').includes('\u00BF'),
    );
    expect(conInvertido).toHaveLength(18);
  });

  it('calcula un checksum estable para detectar reimportaciones', () => {
    const a = computeChecksum(buffer);
    const b = computeChecksum(readFileSync(RUTA_ARCHIVO));

    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(b);
  });

  it('valida el dígito verificador con la regla correcta en un caso límite', () => {
    // resto = 1 => digito = 11 - 1 = 10 => se usa 0. Es el caso de 20541487710,
    // que una implementación ingenua rechazaría.
    expect(isValidRucCheckDigit('20541487710')).toBe(true);
  });
});
