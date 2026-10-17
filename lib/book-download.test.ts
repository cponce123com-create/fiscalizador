import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { cabeceraDescarga, extractoExcel, extractoExcelDesdePaginas, nombreDescargaLibro, tituloLibro } from './book-download';

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
  it('construye XLSX desde páginas manteniendo valores literales y verifica el total', async () => {
    async function* paginas() {
      yield [{ ruc: '00123456789', descripcion: '=SUM(1,2)' }];
      yield [{ ruc: '10987654321', descripcion: 'Servicio de difusión' }];
    }
    const bytes = await extractoExcelDesdePaginas(['ruc', 'descripcion'], paginas(), 2);
    const hoja = XLSX.read(bytes, { type: 'array' }).Sheets['Extracto público'];
    expect(hoja.A2.v).toBe('00123456789');
    expect(hoja.B2.v).toBe('=SUM(1,2)');
    expect(hoja.B2.f).toBeUndefined();
    expect(hoja.B3.v).toBe('Servicio de difusión');
  });
  it('rechaza una exportación XLSX cuyo número de filas no coincide', async () => {
    async function* paginas() { yield [{ ruc: '1' }]; }
    await expect(extractoExcelDesdePaginas(['ruc'], paginas(), 2)).rejects.toThrow('esperaba 2 filas y leyó 1');
  });
  it.each([100, 1_000, 10_000, 20_000])('genera un XLSX legible con %s filas en páginas', async (cantidad) => {
    async function* paginas() {
      for (let inicio = 0; inicio < cantidad; inicio += 500) {
        yield Array.from({ length: Math.min(500, cantidad - inicio) }, (_, indice) => ({ ruc: String(inicio + indice + 1) }));
      }
    }
    const bytes = await extractoExcelDesdePaginas(['ruc'], paginas(), cantidad);
    const hoja = XLSX.read(bytes, { type: 'array' }).Sheets['Extracto público'];
    expect(hoja['!ref']).toBe(`A1:A${cantidad + 1}`);
  });
});
