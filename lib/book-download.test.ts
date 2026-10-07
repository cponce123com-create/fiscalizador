import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { cabeceraDescarga, extractoExcel, nombreDescargaLibro, tituloLibro } from './book-download';

describe('descargas de libros', () => {
  const libro = { importType: 'ORDENES_SERVICIO', month: 2, year: 2026, version: 2 };
  it('nombra libros por tipo, mes, año, municipio y versión', () => {
    expect(tituloLibro(libro, 'Municipalidad de San Ramón')).toBe('Órdenes de servicio - Febrero 2026 - Municipalidad de San Ramón - v2');
    expect(nombreDescargaLibro(libro, 'San Ramón\r\n/"', 'xlsx')).not.toMatch(/[\r\n/"\\]/);
    expect(cabeceraDescarga('Órdenes.xlsx')).toContain("filename*=UTF-8''%C3%93rdenes.xlsx");
  });
  it('preserva acentos, ceros iniciales y texto literal; excluye campos privados', () => {
    const bytes = extractoExcel(['ruc', 'descripcion'], [{ ruc: '00123456789', descripcion: '=SUM(1,2) — Ramón', privado: 'secreto' }]);
    const sheet = XLSX.read(bytes, { type: 'array' }).Sheets['Extracto público'];
    expect(sheet.A2.v).toBe('00123456789');
    expect(sheet.A2.t).toBe('s');
    expect(sheet.B2.v).toBe('=SUM(1,2) — Ramón');
    expect(sheet.B2.f).toBeUndefined();
    expect(sheet.C2).toBeUndefined();
  });
});
