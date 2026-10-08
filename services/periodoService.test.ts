import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { detectarPeriodo } from '@/services/periodoService';

function libro(fechas: (string | null)[], titulo?: string) {
  const filas = [
    ...(titulo ? [[titulo]] : []),
    ['Número de orden', 'Fecha de Emisión', 'Fecha de Compromiso', 'RUC', 'Monto'],
    ...fechas.map((fecha, i) => [String(i + 1), fecha, '2018-12-31', 'RUC MAL DIGITADO', 'MONTO MAL DIGITADO']),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), 'Sheet0');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

describe('periodo de importación sin base de datos', () => {
  it('lee todas las fechas aunque otras columnas tengan errores, sin usar compromiso ni el contador del nombre', async () => {
    const r = await detectarPeriodo(libro(['2018-02-03', '2018-02-20']), 'Lista-OCOS (12).xls');
    expect(r.periodoSugerido).toBe('2018-02');
    expect(r.fuente).toBe('fechas');
    expect(r.mesesDetectados).toEqual([{ periodo: '2018-02', filas: 2 }]);
    expect(r.filasLeidas).toBe(2);
  });
  it('no convierte el mes mayoritario en el periodo del reporte', async () => {
    const r = await detectarPeriodo(libro(['2018-12-01', '2018-12-02', '2018-02-02']), 'Lista-OCOS.xls');
    expect(r.periodoSugerido).toBeNull();
    expect(r.aviso).toContain('varios meses');
    expect(r.mesesDetectados).toHaveLength(2);
  });
  it('respeta un título explícito del reporte e informa de fechas de otro mes', async () => {
    const r = await detectarPeriodo(libro(['2018-12-01', '2018-12-02', '2018-02-02'], 'ÓRDENES FEBRERO - 2018'), 'Lista-OCOS.xls');
    expect(r.periodoSugerido).toBe('2018-02');
    expect(r.fuente).toBe('titulo');
    expect(r.aviso).toContain('difieren');
  });
  it('requiere seleccionar si el nombre y el contenido se contradicen', async () => {
    const r = await detectarPeriodo(libro(['2018-12-01']), 'Ordenes-2018-02.xls');
    expect(r.periodoSugerido).toBeNull();
    expect(r.coincideConElNombre).toBe(false);
  });
  it('no inventa el mes actual ni toma la fecha de compromiso cuando no hay emisión', async () => {
    const r = await detectarPeriodo(libro([null]), 'Lista-OCOS (5).xls');
    expect(r.periodoSugerido).toBeNull();
    expect(r.mesesDetectados).toEqual([]);
    expect(r.aviso).toContain('No se pudo');
  });
  it('detecta el mismo contenido descargado con nombres diferentes', async () => {
    const buffer = libro(['2018-12-01']);
    const a = await detectarPeriodo(buffer, 'Lista-OCOS (5).xls');
    const b = await detectarPeriodo(buffer, 'Lista-OCOS (6).xls');
    expect(a.checksum).toBe(b.checksum);
  });
  it('no busca títulos en la descripción de una fila', async () => {
    const r = await detectarPeriodo(libro(['2018-03-12', 'COMPRA DICIEMBRE - 2018']), 'Lista-OCOS.xls');
    expect(r.periodoDelTitulo).toBeNull();
    expect(r.periodoSugerido).toBe('2018-03');
    expect(r.aviso).toContain('1 filas');
  });
  it('mantiene el periodo y las 103 filas del Excel BIFF8 real', async () => {
    const r = await detectarPeriodo(readFileSync('docs/reference/Lista-OCOS-2023-06.xls'), 'Lista-OCOS.xls');
    expect(r.periodoSugerido).toBe('2023-06');
    expect(r.filasLeidas).toBe(103);
  });
});
