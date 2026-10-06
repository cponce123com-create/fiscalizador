import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  camposObligatoriosFaltantes,
  indicesPorCampo,
  mapColumns,
  matchHeader,
  similarity,
  tokenSimilarity,
} from '@/services/mappingService';
import { parseSpreadsheet } from '@/services/parseService';

const RUTA_ARCHIVO = path.join(process.cwd(), 'docs', 'reference', 'Lista-OCOS-2023-06.xls');

describe('matchHeader contra los encabezados reales', () => {
  const esperado: Array<[string, string]> = [
    ['N°', 'rowNumber'],
    ['Tipo de Orden', 'orderType'],
    ['Número de orden', 'orderNumber'],
    ['Tipo de Contratación', 'contractType'],
    ['Descripción y Finalidad de la contratación', 'description'],
    ['Nro. Exp. SIAF', 'siafNumber'],
    ['Fecha de Emisión', 'issueDate'],
    ['Fecha de Compromiso', 'commitmentDate'],
    ['Estado', 'status'],
    ['Monto', 'amount'],
    ['RUC', 'ruc'],
    ['Denominación o razón Social', 'supplierName'],
  ];

  it.each(esperado)('mapea "%s" a %s con coincidencia exacta', (encabezado, campo) => {
    const r = matchHeader(encabezado);
    expect(r.field).toBe(campo);
    expect(r.matchedBy).toBe('EXACTO');
    expect(r.confidence).toBe(1);
  });

  it('reconoce variantes de nombre sin coincidencia exacta', () => {
    expect(matchHeader('Razon Social').field).toBe('supplierName');
    expect(matchHeader('RAZÓN SOCIAL').field).toBe('supplierName');
    expect(matchHeader('Importe').field).toBe('amount');
    expect(matchHeader('Nro Orden').field).toBe('orderNumber');
    expect(matchHeader('SIAF').field).toBe('siafNumber');
    expect(matchHeader('Proveedor').field).toBe('supplierName');
    expect(matchHeader('Fecha Emision').field).toBe('issueDate');
  });

  it('ignora tildes, mayúsculas y puntuación al emparejar', () => {
    expect(matchHeader('  MONTO  ').field).toBe('amount');
    expect(matchHeader('Tipo de Contratacion').field).toBe('contractType');
  });

  it('deja sin mapear un encabezado que no reconoce', () => {
    const r = matchHeader('Columna Inventada XYZ');
    expect(r.field).toBeNull();
    expect(r.matchedBy).toBeNull();
  });

  it('devuelve null para un encabezado vacío', () => {
    expect(matchHeader('').field).toBeNull();
    expect(matchHeader('   ').field).toBeNull();
  });
});

describe('similitud', () => {
  it('vale 1 para cadenas idénticas', () => {
    expect(similarity('monto', 'monto')).toBe(1);
    expect(tokenSimilarity('monto total', 'monto total')).toBe(1);
  });

  it('vale 0 cuando no comparten nada', () => {
    expect(tokenSimilarity('monto', 'ruc')).toBe(0);
  });

  it('tolera errores de tipeo', () => {
    expect(similarity('montoo', 'monto')).toBeGreaterThan(0.8);
  });

  it('penaliza las palabras funcionales en la similitud por tokens', () => {
    // Jaccard: {numero, de, orden} vs {numero, orden} => 2 comunes de 3 de
    // unión = 2/3. La preposición "de" cuenta como diferencia, así que la
    // similitud por tokens NO sustituye al catálogo de alias: los encabezados
    // con y sin "de" se resuelven por alias explícito, no por fuzzy matching.
    expect(tokenSimilarity('numero de orden', 'numero orden')).toBeCloseTo(2 / 3, 5);
    expect(matchHeader('Numero Orden').matchedBy).toBe('ALIAS');
  });
});

describe('matchHeader no adivina con encabezados de varias palabras', () => {
  /**
   * Regresión de un fallo real: los encabezados de un conjunto de datos abiertos (todo
   * prefijado con «ORDEN_») se mapeaban a campos equivocados con confianza alta.
   */
  const equivocados: Array<[string, string]> = [
    ['ANNO_ORDEN', 'orderNumber'],
    ['NRO_MES_ORDEN', 'orderNumber'],
    ['ORDEN_PROVEEDOR', 'ruc'],
  ];

  it.each(equivocados)('no propone %s como %s', (encabezado, campo) => {
    expect(matchHeader(encabezado).field).not.toBe(campo);
  });

  it.each(equivocados)('deja %s sin mapear en lugar de arriesgarse', (encabezado) => {
    expect(matchHeader(encabezado).field).toBeNull();
    expect(matchHeader(encabezado).matchedBy).toBeNull();
  });

  it('explica el caso que duele: el año como número de orden', () => {
    // «anno orden» y «nro orden» se parecen en 8 de cada 10 caracteres y no tienen nada que
    // ver. Con la distancia de edición sola, el año entraba como número de orden.
    expect(similarity('anno orden', 'nro orden')).toBeGreaterThan(0.72);
    expect(tokenSimilarity('anno orden', 'nro orden')).toBeLessThan(0.72);
    // Aun así no se propone: con varias palabras no se adivina.
    expect(matchHeader('ANNO_ORDEN').field).toBeNull();
  });

  it('sigue detectando erratas en encabezados de una palabra', () => {
    expect(matchHeader('Montoo').field).toBe('amount');
    expect(matchHeader('Montoo').matchedBy).toBe('SIMILITUD');
    expect(matchHeader('Estao').field).toBe('status');
  });

  it('no compara una palabra contra un alias de varias', () => {
    // «Chirimoya» no se parece a nada; y no debe acabar en un campo por parecerse en
    // longitud a un alias largo.
    expect(matchHeader('Chirimoya').field).toBeNull();
  });

  it('sigue mapeando por alias, que es el mecanismo previsto', () => {
    expect(matchHeader('Razon Social').matchedBy).toBe('ALIAS');
    expect(matchHeader('Fecha Emision').matchedBy).toBe('ALIAS');
    expect(matchHeader('Nro Orden').matchedBy).toBe('ALIAS');
  });

  it('deja el CSV de datos abiertos con los obligatorios sin cubrir', () => {
    // Es el comportamiento correcto: el importador avisa de que faltan campos en lugar de
    // rellenarlos con lo primero que encuentre.
    const cabeceras = [
      'TIPO_ORDEN',
      'ANNO_ORDEN',
      'NRO_MES_ORDEN',
      'ORDEN_RUC',
      'ORDEN_FECHA',
      'ORDEN_MONTO',
      'ORDEN_PROVEEDOR',
      'ORDEN_DESCRIPCION',
    ];

    const faltantes = camposObligatoriosFaltantes(mapColumns(cabeceras, []));

    expect(faltantes).toContain('orderNumber');
    expect(faltantes).toContain('issueDate');
    expect(faltantes).toContain('amount');
    expect(faltantes).toContain('ruc');
    expect(faltantes).toContain('supplierName');
  });
});

describe('mapColumns sobre el archivo real', () => {
  const buffer = readFileSync(RUTA_ARCHIVO);
  const hoja = parseSpreadsheet(buffer);
  const mappings = mapColumns(hoja.headers, hoja.rows);

  it('mapea las 12 columnas sin dejar ninguna sin asignar', () => {
    expect(mappings).toHaveLength(12);
    expect(mappings.every((m) => m.field !== null)).toBe(true);
  });

  it('no asigna el mismo campo interno a dos columnas', () => {
    const campos = mappings.map((m) => m.field).filter(Boolean);
    expect(new Set(campos).size).toBe(campos.length);
  });

  it('no reporta campos obligatorios faltantes', () => {
    expect(camposObligatoriosFaltantes(mappings)).toEqual([]);
  });

  it('propone como público el número de fila en falso', () => {
    const nro = mappings.find((m) => m.field === 'rowNumber');
    expect(nro?.isPublic).toBe(false);
  });

  it('propone como públicos los campos de datos', () => {
    for (const campo of ['orderNumber', 'amount', 'ruc', 'supplierName'] as const) {
      expect(mappings.find((m) => m.field === campo)?.isPublic).toBe(true);
    }
  });

  it('incluye valores de muestra para la vista previa del administrador', () => {
    const monto = mappings.find((m) => m.field === 'amount');
    expect(monto?.sampleValues[0]).toBe('S/. 650');
    expect(monto?.sampleValues).toHaveLength(3);
  });

  it('construye el índice de columnas por campo', () => {
    const indices = indicesPorCampo(mappings);
    expect(indices.orderNumber).toBe(2);
    expect(indices.amount).toBe(9);
    expect(indices.ruc).toBe(10);
    expect(indices.supplierName).toBe(11);
  });
});

describe('mapColumns con libros de forma distinta', () => {
  it('se adapta a columnas en otro orden y con otros nombres', () => {
    const headers = ['RUC', 'Proveedor', 'Importe', 'Nro Orden', 'Estado', 'Fecha Emision'];
    const rows = [['20541487710', 'EMPRESA XYZ', 'S/. 100', '55', 'Devengada', '01/02/2024']];

    const mappings = mapColumns(headers, rows);
    const porCampo = Object.fromEntries(
      mappings.filter((m) => m.field).map((m) => [m.field, m.position]),
    );

    expect(porCampo).toMatchObject({
      ruc: 0,
      supplierName: 1,
      amount: 2,
      orderNumber: 3,
      status: 4,
      issueDate: 5,
    });
  });

  it('detecta los campos obligatorios que faltan', () => {
    const mappings = mapColumns(['RUC', 'Proveedor'], [[], []]);
    const faltantes = camposObligatoriosFaltantes(mappings);

    expect(faltantes).toContain('orderNumber');
    expect(faltantes).toContain('amount');
    expect(faltantes).toContain('issueDate');
    expect(faltantes).toContain('status');
    expect(faltantes).not.toContain('ruc');
  });

  it('resuelve colisiones conservando la coincidencia más fuerte', () => {
    // "Monto" es exacto; "Importe" es alias. Debe ganar "Monto".
    const mappings = mapColumns(['Importe', 'Monto'], [['1', '2']]);
    const ganador = mappings.find((m) => m.field === 'amount');

    expect(ganador?.originalName).toBe('Monto');
    expect(mappings.find((m) => m.originalName === 'Importe')?.field).toBeNull();
  });
});
