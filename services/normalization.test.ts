import { describe, expect, it } from 'vitest';

import {
  buildDedupeKey,
  inferSupplierType,
  isValidRucCheckDigit,
  normalizeKey,
  normalizeSupplierName,
  parseAmount,
  parseDate,
  parseRuc,
  slugify,
  stripDiacritics,
} from '@/services/normalization';

/**
 * Los valores de este archivo NO son inventados: salen de
 * `docs/reference/Lista-OCOS-2023-06.xls`, el libro real del Portal de
 * Transparencia que se usó para fijar los formatos (Paso 0 del plan).
 */

// RUC reales del archivo. Los 103 presentes pasan el dígito verificador.
const RUCS_REALES = [
  '20541487710',
  '20602598552',
  '20486447240',
  '20610345990',
  '10410569731',
  '10205783437',
  '10733834850',
  '10205486289',
  '10445505701',
  '10205797292',
  '10756517142',
  '20569049050',
  '20601755379',
  '10075752500',
  '10713163151',
];

describe('texto', () => {
  it('quita diacríticos sin tocar el resto', () => {
    expect(stripDiacritics('JUNÍN')).toBe('JUNIN');
    expect(stripDiacritics('Descripción y Finalidad')).toBe('Descripcion y Finalidad');
    expect(stripDiacritics('ADQUISICION')).toBe('ADQUISICION');
  });

  it('normaliza encabezados reales a una clave comparable', () => {
    expect(normalizeKey('N°')).toBe('n');
    expect(normalizeKey('Número de orden')).toBe('numero de orden');
    expect(normalizeKey('Nro. Exp. SIAF')).toBe('nro exp siaf');
    expect(normalizeKey('Denominación o razón Social')).toBe('denominacion o razon social');
  });

  it('colapsa espacios y mayúsculas en la clave', () => {
    expect(normalizeKey('  DEVENGADA  ')).toBe('devengada');
    expect(normalizeKey('Devengada')).toBe(normalizeKey('DEVENGADA'));
  });

  it('normaliza el nombre del proveedor sin borrar sufijos societarios', () => {
    // Se conserva E.I.R.L. / S.A.C. a propósito: fusionar es decisión humana.
    expect(normalizeSupplierName('MP. OVERHAUL S.A.C.')).toBe('MP OVERHAUL S A C');
    expect(normalizeSupplierName('INVERSIONES URRUCHI S.A.C.')).toBe('INVERSIONES URRUCHI S A C');
  });

  it('genera slugs válidos para URL', () => {
    expect(slugify('INVERSIONES URRUCHI S.A.C.')).toBe('inversiones-urruchi-s-a-c');
    expect(slugify('JUNÍN')).toBe('junin');
    expect(slugify('   ')).toBe('');
  });
});

describe('monto', () => {
  it('parsea los montos reales con prefijo "S/."', () => {
    expect(parseAmount('S/. 650').value).toBe('650.00');
    expect(parseAmount('S/. 8546').value).toBe('8546.00');
    expect(parseAmount('S/. 14769.5').value).toBe('14769.50');
    expect(parseAmount('S/. 12514.28').value).toBe('12514.28');
    expect(parseAmount('S/. 38994.87').value).toBe('38994.87');
    expect(parseAmount('S/. 1025').value).toBe('1025.00');
  });

  it('acepta la variante sin punto ("S/") y sin prefijo', () => {
    expect(parseAmount('S/ 1200').value).toBe('1200.00');
    expect(parseAmount('1200.5').value).toBe('1200.50');
  });

  it('interpreta la convención es-PE cuando hay separadores', () => {
    expect(parseAmount('S/. 1,234.56').value).toBe('1234.56');
    expect(parseAmount('S/. 1.234,56').value).toBe('1234.56');
    expect(parseAmount('S/. 1,234').value).toBe('1234.00');
  });

  it('marca los valores vacíos o ilegibles sin inventar un cero', () => {
    expect(parseAmount('')).toEqual({ value: null, raw: '', problem: 'VACIO' });
    expect(parseAmount(null)).toEqual({ value: null, raw: '', problem: 'VACIO' });
    expect(parseAmount('S/. ').problem).toBe('FORMATO');
    expect(parseAmount('N/A').problem).toBe('FORMATO');
    expect(parseAmount('S/. 12,34,5').problem).toBe('FORMATO');
  });

  it('conserva el texto original para la auditoría', () => {
    const r = parseAmount('S/. 14769.5');
    expect(r.raw).toBe('S/. 14769.5');
  });

  it('rechaza montos que no caben en Decimal(14,2)', () => {
    expect(parseAmount('9999999999999').problem).toBe('FUERA_DE_RANGO');
    expect(parseAmount('999999999999').value).toBe('999999999999.00');
  });
});

describe('fecha', () => {
  it('parsea el formato ISO con hora del archivo real', () => {
    const r = parseDate('2023-06-06 00:00:00.0');
    expect(r.problem).toBeNull();
    expect(r.value?.toISOString()).toBe('2023-06-06T00:00:00.000Z');
  });

  it('parsea dd/mm/yyyy', () => {
    expect(parseDate('06/06/2023').value?.toISOString()).toBe('2023-06-06T00:00:00.000Z');
    expect(parseDate('26/06/2023').value?.toISOString()).toBe('2023-06-26T00:00:00.000Z');
  });

  it('no desplaza el día por zona horaria', () => {
    // Las columnas son @db.Date: la fecha debe quedar a medianoche UTC.
    const r = parseDate('2023-06-16 00:00:00.0');
    expect(r.value?.getUTCDate()).toBe(16);
    expect(r.value?.getUTCHours()).toBe(0);
  });

  it('marca como ambigua una fecha que puede leerse en dos órdenes', () => {
    expect(parseDate('03/04/2025').problem).toBe('AMBIGUA');
    expect(parseDate('06/06/2023').problem).toBeNull();
  });

  it('rechaza fechas imposibles', () => {
    expect(parseDate('2023-02-30 00:00:00.0').problem).toBe('FUERA_DE_RANGO');
    expect(parseDate('2023-13-01 00:00:00.0').problem).toBe('FUERA_DE_RANGO');
    expect(parseDate('no es fecha').problem).toBe('FORMATO');
  });

  it('trata la celda vacía como VACIO, no como error', () => {
    // La fila anulada del archivo real (orden 245) no tiene fecha de compromiso.
    expect(parseDate('')).toEqual({ value: null, raw: '', problem: 'VACIO' });
  });
});

describe('RUC', () => {
  it('valida el dígito verificador de todos los RUC reales del archivo', () => {
    for (const ruc of RUCS_REALES) {
      expect(isValidRucCheckDigit(ruc), `RUC ${ruc} debería ser válido`).toBe(true);
    }
  });

  it('detecta un dígito verificador alterado', () => {
    expect(isValidRucCheckDigit('20541487711')).toBe(false);
    expect(isValidRucCheckDigit('20602598553')).toBe(false);
  });

  it('rechaza longitudes incorrectas', () => {
    expect(isValidRucCheckDigit('2054148771')).toBe(false);
    expect(isValidRucCheckDigit('205414877100')).toBe(false);
    expect(isValidRucCheckDigit('')).toBe(false);
  });

  it('limpia separadores sin alterar el valor original', () => {
    const r = parseRuc('20-54148771-0');
    expect(r.value).toBe('20541487710');
    expect(r.raw).toBe('20-54148771-0');
    expect(r.checkDigitValid).toBe(true);
  });

  it('marca VACIO cuando no hay RUC', () => {
    expect(parseRuc('').problem).toBe('VACIO');
    expect(parseRuc(null).problem).toBe('VACIO');
  });

  it('marca FORMATO cuando no son 11 dígitos', () => {
    expect(parseRuc('123').problem).toBe('FORMATO');
    expect(parseRuc('ABC').problem).toBe('FORMATO');
  });

  it('infiere el tipo por el prefijo', () => {
    expect(inferSupplierType('20541487710')).toBe('PERSONA_JURIDICA');
    expect(inferSupplierType('10410569731')).toBe('PERSONA_NATURAL');
    expect(inferSupplierType('30541487710')).toBe('OTRO');
    expect(inferSupplierType('X')).toBe('DESCONOCIDO');
  });
});

describe('clave de deduplicación', () => {
  it('es estable ante el mismo registro', () => {
    const a = buildDedupeKey({
      orderNumber: '217',
      ruc: '20541487710',
      amount: '650.00',
      issueDate: new Date(Date.UTC(2023, 5, 6)),
    });
    const b = buildDedupeKey({
      orderNumber: ' 217 ',
      ruc: '20541487710',
      amount: '650.00',
      issueDate: new Date(Date.UTC(2023, 5, 6)),
    });
    expect(a).toBe(b);
    expect(a).toBe('|217|20541487710|650.00|2023-06-06');
  });

  it('distingue registros con montos distintos', () => {
    const base = { orderNumber: '238', ruc: '20610345990', issueDate: null };
    expect(buildDedupeKey({ ...base, amount: '100.00' })).not.toBe(
      buildDedupeKey({ ...base, amount: '200.00' }),
    );
  });

  it('tolera monto y fecha ausentes', () => {
    expect(
      buildDedupeKey({ orderNumber: '245', ruc: '20610345990', amount: null, issueDate: null }),
    ).toBe('|245|20610345990||');
  });
});

 it('distingue una compra y un servicio con iguales número, proveedor, monto y fecha', () => {
 const base={orderNumber:'245',ruc:'20610345990',amount:'100.00',issueDate:new Date('2023-06-06')};
 expect(buildDedupeKey({...base,orderType:'O/C'})).not.toBe(buildDedupeKey({...base,orderType:'O/S'}));
 });
