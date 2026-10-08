import { readFileSync } from 'node:fs';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { indicesPorCampo, mapColumns } from '@/services/mappingService';
import { parseSpreadsheet } from '@/services/parseService';
import {
  decimalACentavos,
  validateRows,
  type ManagementPeriodEntry,
  type StatusCatalogEntry,
  type ValidationResult,
} from '@/services/validationService';

/**
 * Catálogo de estados tal como queda sembrado en la base de datos.
 *
 * Lo importante: `isCancelled` y `countsEconomically` son DATOS del catálogo,
 * no coincidencias de texto en el código. Cambiar el catálogo cambia el cálculo
 * sin tocar el importador (docs/prompt.md sección 31).
 */
const ESTADOS: StatusCatalogEntry[] = [
  {
    id: 'est-devengada',
    code: 'DEVENGADA',
    label: 'Devengada',
    aliases: ['devengado', 'devengadas', 'devengados'],
    countsEconomically: true,
    isCancelled: false,
    isUnknown: false,
  },
  {
    id: 'est-anulada',
    code: 'ANULADA',
    label: 'Anulada',
    aliases: ['anulado', 'anuladas', 'anulados', 'cancelada', 'cancelado', 'canceladas'],
    countsEconomically: false,
    isCancelled: true,
    isUnknown: false,
  },
  {
    id: 'est-desconocido',
    code: 'DESCONOCIDO',
    label: 'Desconocido',
    aliases: [],
    countsEconomically: false,
    isCancelled: false,
    isUnknown: true,
  },
];

const TIPOS_ORDEN = [
  { id: 'to-oc', code: 'O/C', label: 'Orden de Compra', aliases: ['oc', 'orden de compra'] },
  { id: 'to-os', code: 'O/S', label: 'Orden de Servicio', aliases: ['os', 'orden de servicio'] },
];

const TIPOS_CONTRATO = [
  {
    id: 'tc-8uit',
    code: 'HASTA_8_UIT',
    label:
      'Contrataciones hasta 8 UIT (LEY 30225)((No incluye las derivadas de contrataciones por catálogo electrónico.))',
    aliases: [],
  },
  {
    id: 'tc-proceso',
    code: 'PROCESO_SELECCION',
    label: 'Deviene de Procesos de Selección',
    aliases: [],
  },
];

const GESTIONES: ManagementPeriodEntry[] = [
  {
    id: 'g-2015-2018',
    name: '2015-2018',
    startDate: new Date(Date.UTC(2015, 0, 1)),
    endDate: new Date(Date.UTC(2018, 11, 31)),
  },
  {
    id: 'g-2019-2022',
    name: '2019-2022',
    startDate: new Date(Date.UTC(2019, 0, 1)),
    endDate: new Date(Date.UTC(2022, 11, 31)),
  },
  {
    id: 'g-2023-2026',
    name: '2023-2026',
    startDate: new Date(Date.UTC(2023, 0, 1)),
    endDate: new Date(Date.UTC(2026, 11, 31)),
  },
];

const RUTA_ARCHIVO = path.join(process.cwd(), 'docs', 'reference', 'Lista-OCOS-2023-06.xls');

describe('validateRows sobre el archivo real', () => {
  let resultado: ValidationResult;

  beforeAll(() => {
    const hoja = parseSpreadsheet(readFileSync(RUTA_ARCHIVO));
    const mappings = mapColumns(hoja.headers, hoja.rows);

    resultado = validateRows({
      headers: hoja.headers,
      rows: hoja.rows,
      indices: indicesPorCampo(mappings),
      headerRowIndex: hoja.headerRowIndex,
      statuses: ESTADOS,
      orderTypes: TIPOS_ORDEN,
      contractTypes: TIPOS_CONTRATO,
      managementPeriods: GESTIONES,
    });
  });

  it('no descarta ninguna de las 103 filas', () => {
    expect(resultado.summary.totalRows).toBe(103);
    expect(resultado.summary.successfulRows).toBe(103);
    expect(resultado.summary.errorRows).toBe(0);
  });

  it('respeta las cifras de control del Paso 0 en centavos exactos', () => {
    expect(resultado.summary.registeredCents).toBe(106613659);
    expect(resultado.summary.cancelledCents).toBe(3899487);
    expect(resultado.summary.consideredCents).toBe(102714172);
  });

  it('EXCLUYE la orden anulada del monto considerado', () => {
    // Escenario obligatorio de la sección 46 del pliego.
    const anulada = resultado.orders.find((o) => o.orderNumber === '245' && o.isCancelled);

    expect(anulada).toBeDefined();
    expect(anulada?.amount).toBe('38994.87');
    expect(anulada?.countsEconomically).toBe(false);
    expect(resultado.summary.cancelledRows).toBe(1);

    // La orden anulada SÍ existe (no se descarta) pero NO suma al considerado.
    expect(resultado.summary.registeredCents - resultado.summary.cancelledCents).toBe(
      resultado.summary.consideredCents,
    );
  });

  it('marca la orden anulada como tal a partir del catálogo, no del texto', () => {
    const anulada = resultado.orders.find((o) => o.orderNumber === '245' && o.isCancelled);
    expect(anulada?.statusId).toBe('est-anulada');
    expect(anulada?.statusRaw).toBe('Anulada');
    expect(anulada?.countsEconomically).toBe(false);
  });

  it('clasifica los 103 estados contra el catálogo sin dejarlos desconocidos', () => {
    const sinClasificar = resultado.orders.filter((o) => o.statusId === 'est-desconocido');
    expect(sinClasificar).toHaveLength(0);
  });

  it('asigna todas las órdenes a la gestión 2023-2026', () => {
    const sinGestion = resultado.orders.filter((o) => o.managementPeriodId === null);
    expect(sinGestion).toHaveLength(0);
    expect(resultado.orders.every((o) => o.managementPeriodId === 'g-2023-2026')).toBe(true);
  });

  it('clasifica los tipos de orden O/C y O/S', () => {
    const oc = resultado.orders.filter((o) => o.orderTypeId === 'to-oc');
    const os = resultado.orders.filter((o) => o.orderTypeId === 'to-os');

    expect(oc).toHaveLength(40);
    expect(os).toHaveLength(63);
    expect(oc.length + os.length).toBe(103);
  });

  it('conserva el registro original en rawData de cada orden', () => {
    for (const orden of resultado.orders) {
      expect(orden.rawData['Monto']).toBeDefined();
      expect(orden.rawData['RUC']).toBeDefined();
      expect(Object.keys(orden.rawData)).toHaveLength(12);
    }

    const primera = resultado.orders[0];
    expect(primera?.rawData['Monto']).toBe('S/. 650');
    expect(primera?.rawAmount).toBeNull();
    expect(primera?.amount).toBe('650.00');
  });

  it('no emite ningún ERROR sobre un archivo íntegro', () => {
    const errores = resultado.issues.filter((i) => i.severity === 'ERROR');
    expect(errores).toEqual([]);
  });

  it('numera las filas como se ven en el archivo, con el encabezado en la 1', () => {
    // El encabezado está en la fila 1, así que el primer registro es la fila 2.
    expect(resultado.orders[0]?.sourceRow).toBe(2);
    expect(resultado.orders[102]?.sourceRow).toBe(104);
  });
});

describe('validateRows: reglas de clasificación', () => {
  const base = {
    headers: [
      'Número de orden',
      'Estado',
      'Monto',
      'RUC',
      'Denominación o razón Social',
      'Fecha de Emisión',
    ],
    headerRowIndex: 0,
    statuses: ESTADOS,
    orderTypes: TIPOS_ORDEN,
    contractTypes: TIPOS_CONTRATO,
    managementPeriods: GESTIONES,
  };
  const indices = {
    orderNumber: 0,
    status: 1,
    amount: 2,
    ruc: 3,
    supplierName: 4,
    issueDate: 5,
  } as const;

  function validar(filas: unknown[][]) {
    return validateRows({ ...base, rows: filas, indices });
  }

  it('trata un estado no catalogado como advertencia y NO lo suma', () => {
    const r = validar([
      ['100', 'En Proceso', 'S/. 500', '20541487710', 'ACME S.A.C.', '2023-06-01 00:00:00.0'],
    ]);

    const issue = r.issues.find((i) => i.code === 'ESTADO_DESCONOCIDO');
    expect(issue?.severity).toBe('WARNING');
    expect(r.orders[0]?.statusId).toBe('est-desconocido');
    expect(r.orders[0]?.countsEconomically).toBe(false);
    // Un estado que no cuenta económicamente no engrosa el monto considerado.
    expect(r.summary.registeredCents).toBe(50000);
    expect(r.summary.consideredCents).toBe(0);
  });

  it('bloquea la fila cuando falta el RUC', () => {
    const r = validar([
      ['100', 'Devengada', 'S/. 500', '', 'ACME S.A.C.', '2023-06-01 00:00:00.0'],
    ]);

    expect(r.summary.errorRows).toBe(1);
    expect(r.summary.successfulRows).toBe(0);
    expect(r.issues.some((i) => i.code === 'RUC_VACIO' && i.severity === 'ERROR')).toBe(true);
  });

  it('advierte por dígito verificador incorrecto pero conserva el RUC', () => {
    const r = validar([
      ['100', 'Devengada', 'S/. 500', '20541487711', 'ACME S.A.C.', '2023-06-01 00:00:00.0'],
    ]);

    const issue = r.issues.find((i) => i.code === 'RUC_DIGITO_VERIFICADOR');
    expect(issue?.severity).toBe('WARNING');
    // El dato original se conserva: no se corrige ni se descarta.
    expect(r.orders[0]?.ruc).toBe('20541487711');
    expect(r.summary.successfulRows).toBe(1);
  });

  it('bloquea la fila cuando falta el número de orden', () => {
    const r = validar([
      ['', 'Devengada', 'S/. 500', '20541487710', 'ACME S.A.C.', '2023-06-01 00:00:00.0'],
    ]);
    expect(r.summary.errorRows).toBe(1);
    expect(r.issues.some((i) => i.code === 'ORDEN_NUMERO_VACIO')).toBe(true);
  });

  it('no inventa un cero cuando el monto no se entiende', () => {
    const r = validar([
      ['100', 'Devengada', 'ilegible', '20541487710', 'ACME S.A.C.', '2023-06-01 00:00:00.0'],
    ]);

    expect(r.orders[0]?.amount).toBeNull();
    expect(r.orders[0]?.rawAmount).toBe('ilegible');
    expect(r.summary.registeredCents).toBe(0);
    expect(r.issues.some((i) => i.code === 'MONTO_FORMATO')).toBe(true);
  });

  it('detecta un duplicado dentro del mismo lote', () => {
    const fila = [
      '100',
      'Devengada',
      'S/. 500',
      '20541487710',
      'ACME S.A.C.',
      '2023-06-01 00:00:00.0',
    ];
    const r = validar([fila, fila]);

    const dup = r.issues.find((i) => i.code === 'DUPLICADO_EN_LOTE');
    expect(dup?.severity).toBe('WARNING');
    // Se advierte pero no se bloquea: la decisión es del administrador.
    expect(r.summary.successfulRows).toBe(2);
  });

  it('no marca como duplicadas dos órdenes distintas con el mismo número', () => {
    const r = validar([
      ['100', 'Devengada', 'S/. 500', '20541487710', 'ACME S.A.C.', '2023-06-01 00:00:00.0'],
      ['100', 'Devengada', 'S/. 700', '20541487710', 'ACME S.A.C.', '2023-06-01 00:00:00.0'],
    ]);

    expect(r.issues.some((i) => i.code === 'DUPLICADO_EN_LOTE')).toBe(false);
    expect(r.summary.registeredCents).toBe(120000);
  });

  it('advierte cuando la fecha no cae en ninguna gestión registrada', () => {
    const r = validar([
      ['100', 'Devengada', 'S/. 500', '20541487710', 'ACME S.A.C.', '2010-01-01 00:00:00.0'],
    ]);

    expect(r.issues.some((i) => i.code === 'SIN_GESTION' && i.severity === 'INFO')).toBe(true);
    expect(r.orders[0]?.managementPeriodId).toBeNull();
  });

  it('convierte el monto a centavos sin error de coma flotante', () => {
    expect(decimalACentavos('14769.50')).toBe(1476950);
    expect(decimalACentavos('0.07')).toBe(7);
    expect(decimalACentavos('1234567.89')).toBe(123456789);
  });

  it('suma 103 montos con decimales sin desviarse un solo centavo', () => {
    // 103 filas: 35 con 14769.50, 34 con 12514.28 y 34 con 650.00.
    // Suma exacta en centavos: 51.693.250 + 42.548.552 + 2.210.000 = 96.451.802.
    // Con aritmética de coma flotante esta suma se desviaría.
    const filas = Array.from({ length: 103 }, (_, i) => [
      String(i + 1),
      'Devengada',
      i % 3 === 0 ? 'S/. 14769.5' : i % 3 === 1 ? 'S/. 12514.28' : 'S/. 650',
      '20541487710',
      'ACME S.A.C.',
      '2023-06-01 00:00:00.0',
    ]);

    const r = validar(filas);

    expect(r.summary.registeredCents).toBe(35 * 1476950 + 34 * 1251428 + 34 * 65000);
    expect(r.summary.registeredCents).toBe(96451802);
  });
});

describe('trazabilidad con filas físicas', () => {
  it('conserva los saltos de fila del archivo en órdenes y hallazgos', () => {
    const headers = ['Número de orden', 'RUC', 'Monto', 'Estado'];
    const mapping = indicesPorCampo(mapColumns(headers, []));
    const r = validateRows({
      headers,
      rows: [
        ['1', '20541487710', '100', 'Devengada'],
        ['2', '20541487710', '120', 'No catalogado'],
      ],
      headerRowIndex: 0,
      sourceRows: [2, 4],
      indices: mapping,
      statuses: ESTADOS,
      orderTypes: TIPOS_ORDEN,
      contractTypes: TIPOS_CONTRATO,
      managementPeriods: GESTIONES,
    });
    expect(r.orders.map((o) => o.sourceRow)).toEqual([2, 4]);
    expect(r.issues.some((i) => i.sourceRow === 4)).toBe(true);
  });
});

describe('montos desproporcionados antes de importar', () => {
  function validar(montos: unknown[], estados?: string[], sourceRows?: number[]) {
    return validateRows({
      headers: ['Orden', 'Monto', 'RUC', 'Proveedor', 'Estado', 'Fecha'], headerRowIndex: 0,
      indices: { orderNumber: 0, amount: 1, ruc: 2, supplierName: 3, status: 4, issueDate: 5 },
      rows: montos.map((monto, i) => [String(i + 1), monto, '20541487710', 'ACME', estados?.[i] ?? 'Devengada', '2015-12-01 00:00:00.0']),
      sourceRows, statuses: ESTADOS, orderTypes: [], contractTypes: [], managementPeriods: GESTIONES,
    });
  }

  it('detecta una cifra de miles de millones que sí cabe en Decimal(14,2)', () => {
    const r = validar([100, 150, 200, 300, '61726647029.20'], undefined, [2, 5, 9, 12, 389]);
    expect(r.summary.warningRows).toBe(1);
    expect(r.issues.filter(i => i.code.startsWith('MONTO_')).map(i => i.code)).toEqual(['MONTO_ALTO', 'MONTO_ATIPICO']);
    expect(r.issues.find(i => i.code === 'MONTO_ALTO')).toMatchObject({ sourceRow: 389, rawValue: '61726647029.20', severity: 'WARNING' });
    expect(r.orders[4]?.amount).toBe('61726647029.20'); // Nunca corrige el original.
  });

  it('advierte por encima de dos millones incluso si todas las filas son igualmente elevadas', () => {
    const r = validar([2_000_000.01, 2_000_000.01, 2_000_000.01, 2_000_000.01, 2_000_000.01]);
    expect(r.summary.warningRows).toBe(5);
    expect(r.issues.filter(i => i.code === 'MONTO_ATIPICO')).toHaveLength(0);
  });

  it('respeta exactamente el umbral de dos millones sin aplicar un límite al total del libro', () => {
    const r = validar([1_000_000, 2_000_000, '2,000,000.01']);
    expect(r.issues.filter(i => i.code === 'MONTO_ALTO').map(i => i.sourceRow)).toEqual([4]);
    expect(r.orders.map(o => o.amount)).toEqual(['1000000.00', '2000000.00', '2000000.01']);
  });

  it('detecta un atípico inferior a un millón sin usar un promedio contaminado', () => {
    const r = validar([100, 200, 300, 400, 500, 125_000]);
    expect(r.issues.filter(i => i.code === 'MONTO_ATIPICO')).toHaveLength(1);
    expect(r.issues.some(i => i.code === 'MONTO_ALTO')).toBe(false);
  });

  it('no confunde variaciones normales, libros pequeños ni ceros con errores', () => {
    expect(validar([100, 200, 500, 10_000, 35_000]).issues.some(i => i.code.startsWith('MONTO_'))).toBe(false);
    expect(validar([100, 125_000]).issues.some(i => i.code === 'MONTO_ATIPICO')).toBe(false);
    expect(validar([0, 0, 0, 0, 125_000]).issues.some(i => i.code === 'MONTO_ATIPICO')).toBe(false);
  });

  it('no exige revisar montos sospechosos en órdenes anuladas porque no cuentan económicamente', () => {
    const r = validar(['20541487710'], ['Anulada']);
    expect(r.issues.some(i => i.code.startsWith('MONTO_'))).toBe(false);
    expect(r.orders[0]?.hasWarning).toBe(false);
    expect(r.summary.warningRows).toBe(0);
    expect(r.summary.consideredCents).toBe(0);
  });

  it('mantiene los separadores de miles y decimales válidos', () => {
    const r = validar(['S/. 1,234.56', 'S/. 1.234,56', '1234,56']);
    expect(r.orders.map(o => o.amount)).toEqual(['1234.56', '1234.56', '1234.56']);
    expect(r.issues.some(i => i.code.startsWith('MONTO_'))).toBe(false);
  });
});
