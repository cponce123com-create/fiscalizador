import * as XLSX from 'xlsx';

export type DatosNombreLibro = { importType: string; month: number; year: number; version: number };
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export function tituloLibro(libro: DatosNombreLibro, municipio: string): string {
  const tipo = libro.importType === 'ORDENES_COMPRA' ? 'Órdenes de compra' : libro.importType === 'ORDENES_SERVICIO' ? 'Órdenes de servicio' : 'Órdenes de compra y de servicio';
  return `${tipo} - ${MESES[libro.month - 1] ?? libro.month} ${libro.year} - ${municipio} - v${libro.version}`;
}
export function nombreDescargaLibro(libro: DatosNombreLibro, municipio: string, extension: string, extracto = false): string {
  const base = tituloLibro(libro, municipio).replace(/[\p{C}<>:"/\\|?*]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 190);
  return `${extracto ? 'Extracto público - ' : ''}${base}.${extension}`;
}
export function cabeceraDescarga(nombre: string): string {
  const ascii = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ._-]/g, '_');
  const codificado = encodeURIComponent(nombre).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${codificado}`;
}
/** Texto literal: mantiene RUC/números de orden y nunca crea celdas de fórmula. */
export function extractoExcel(campos: string[], filas: Record<string, unknown>[]): Uint8Array {
  const valores = [campos, ...filas.map(fila => campos.map(campo => fila[campo] == null ? '' : String(fila[campo])))];
  const hoja = XLSX.utils.aoa_to_sheet(valores);
  hoja['!cols'] = campos.map(campo => ({ wch: ['description', 'supplierName'].includes(campo) ? 50 : 24 }));
  if (filas.length && campos.length) hoja['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length, c: campos.length - 1 } }) };
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Extracto público');
  return XLSX.write(libro, { type: 'array', bookType: 'xlsx', compression: true });
}

/**
 * Construye el XLSX desde páginas para no retener además del libro completo
 * copias completas de todas las filas Prisma y de sus objetos de exportación.
 * SheetJS aún conserva las celdas y el buffer final en memoria; por eso el
 * endpoint mantiene un límite explícito de filas.
 */
export async function extractoExcelDesdePaginas(
  campos: string[],
  paginas: AsyncIterable<readonly Record<string, unknown>[]>,
  filasEsperadas: number,
): Promise<Uint8Array> {
  const hoja = XLSX.utils.aoa_to_sheet([campos]);
  let filasEscritas = 0;
  for await (const pagina of paginas) {
    if (!pagina.length) continue;
    const valores = pagina.map(fila => campos.map(campo => fila[campo] == null ? '' : String(fila[campo])));
    XLSX.utils.sheet_add_aoa(hoja, valores, { origin: { r: filasEscritas + 1, c: 0 } });
    filasEscritas += pagina.length;
  }
  if (filasEscritas !== filasEsperadas) {
    throw new Error(`La exportación XLSX esperaba ${filasEsperadas} filas y leyó ${filasEscritas}.`);
  }
  hoja['!cols'] = campos.map(campo => ({ wch: ['description', 'supplierName'].includes(campo) ? 50 : 24 }));
  if (filasEscritas && campos.length) hoja['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filasEscritas, c: campos.length - 1 } }) };
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Extracto público');
  return XLSX.write(libro, { type: 'array', bookType: 'xlsx', compression: true });
}
