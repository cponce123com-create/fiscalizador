import * as XLSX from 'xlsx';
import { enlacesAnualesSeace, MESES_SEACE } from '@/lib/descargas-seace';
import { ErrorDeNegocio } from '@/lib/errors';

const MAX_EXCEL = 25 * 1024 * 1024;
const MAX_HTML = 2 * 1024 * 1024;
const sesiones = new Set<string>();
const BASE = 'https://prod2.seace.gob.pe/seacebus-uiwd-pub/buscadorPublico/ongei/buscadorPublicoOCOS.xhtml';

function atributo(tag: string, nombre: string) {
  const valor = new RegExp(`(?:^|\\s)${nombre}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(tag)?.[2];
  return valor?.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
/** El estado procede del GET de este mes, nunca de datos enviados por el cliente. */
export function formularioExportacion(html: string, anio: number, mes: number) {
  const form = [...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)].find(m => atributo(m[1], 'id') === 'formBuscador');
  const fallo = () => new ErrorDeNegocio('SEACE no mostró el formulario de exportación esperado. Usa el enlace manual de este mes.');
  if (!form || atributo(form[1], 'method')?.toLowerCase() !== 'post' || atributo(form[1], 'action') !== new URL(BASE).pathname) throw fallo();
  const contenido = form[2];
  const boton = [...contenido.matchAll(/<button\b([^>]*)>/gi)].some(m => atributo(m[1], 'name') === 'formBuscador:btnExportar' && atributo(m[1], 'type')?.toLowerCase() === 'submit');
  const inputs = new Map<string, string>();
  for (const m of contenido.matchAll(/<input\b([^>]*)>/gi)) {
    const nombre = atributo(m[1], 'name');
    if (nombre && atributo(m[1], 'type')?.toLowerCase() === 'hidden') inputs.set(nombre, atributo(m[1], 'value') ?? '');
  }
  const estado = inputs.get('javax.faces.ViewState');
  if (!boton || inputs.get('formBuscador') !== 'formBuscador' || !inputs.has('formBuscador:hddIniciaBusqueda') || !estado || estado.length > 4096) throw fallo();
  const nombreMes = mes === 9 ? '(?:SEPTIEMBRE|SETIEMBRE)' : MESES_SEACE[mes - 1].toUpperCase();
  const texto = contenido.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ');
  if (!new RegExp(`\\b${nombreMes}\\s*-\\s*${anio}\\b`, 'i').test(texto)) {
    throw new ErrorDeNegocio('SEACE no confirmó el mes y año solicitados. Usa el enlace manual para comprobarlo.');
  }
  return new URLSearchParams({ formBuscador: 'formBuscador', 'formBuscador:btnExportar': '', 'formBuscador:hddIniciaBusqueda': inputs.get('formBuscador:hddIniciaBusqueda')!, 'javax.faces.ViewState': estado });
}
async function leer(respuesta: Response, maximo: number) {
  if (Number(respuesta.headers.get('content-length')) > maximo) {
    await respuesta.body?.cancel(); throw new ErrorDeNegocio('La respuesta de SEACE supera el tamaño permitido. Usa la descarga manual.');
  }
  const reader = respuesta.body?.getReader();
  if (!reader) throw new ErrorDeNegocio('SEACE devolvió una respuesta vacía.');
  const partes: Buffer[] = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > maximo) throw new ErrorDeNegocio('La respuesta de SEACE supera el tamaño permitido. Usa la descarga manual.');
      partes.push(Buffer.from(value));
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(partes);
}
async function comprobar(respuesta: Response) {
  if (respuesta.ok) return;
  await respuesta.body?.cancel();
  throw new ErrorDeNegocio(`SEACE respondió HTTP ${respuesta.status}. Usa el enlace manual; no se descargó ningún Excel de este mes.`);
}
function tipoLibro(bytes: Buffer): '.xls' | '.xlsx' {
  const ole = bytes.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'));
  const zip = bytes.subarray(0, 2).toString() === 'PK';
  if (!ole && !zip) throw new ErrorDeNegocio('SEACE devolvió una página o un archivo que no es Excel. Usa el enlace manual.');
  try { if (!XLSX.read(bytes, { type: 'buffer', bookSheets: true }).SheetNames.length) throw new Error(); }
  catch { throw new ErrorDeNegocio('El archivo recibido de SEACE no es un Excel válido.'); }
  return ole ? '.xls' : '.xlsx';
}
export async function descargarExcelSeace(usuario: string, anio: number, mes: number, ruc: string, municipio: string) {
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) throw new ErrorDeNegocio('Mes inválido.');
  let url: string;
  try { url = enlacesAnualesSeace(anio, ruc)[mes - 1].url; }
  catch { throw new ErrorDeNegocio('Año o RUC inválido.'); }
  if (sesiones.has(usuario) || sesiones.size >= 2) throw new ErrorDeNegocio('Hay una descarga en curso. Espera antes de reintentar.');
  sesiones.add(usuario);
  const signal = AbortSignal.timeout(40_000);
  try {
    const pagina = await fetch(url, { headers: { 'User-Agent': 'Fiscalizador/1.0', Accept: 'text/html' }, signal, cache: 'no-store', redirect: 'error' });
    await comprobar(pagina);
    if (!pagina.headers.get('content-type')?.toLowerCase().includes('text/html')) throw new ErrorDeNegocio('SEACE no devolvió la página de consulta esperada.');
    // Solo cookies recién emitidas por SEACE en esta petición; no se almacenan ni registran.
    const cookie = pagina.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
    const form = formularioExportacion((await leer(pagina, MAX_HTML)).toString('utf8'), anio, mes);
    const respuesta = await fetch(BASE, { method: 'POST', headers: { 'User-Agent': 'Fiscalizador/1.0', 'Content-Type': 'application/x-www-form-urlencoded', Referer: url, Origin: new URL(BASE).origin, ...(cookie ? { Cookie: cookie } : {}) }, body: form.toString(), signal, cache: 'no-store', redirect: 'error' });
    await comprobar(respuesta);
    const tipo = respuesta.headers.get('content-type')?.toLowerCase() ?? '';
    if (!['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'].some(t => tipo.startsWith(t)) || !/^attachment\b/i.test(respuesta.headers.get('content-disposition') ?? '')) {
      await respuesta.body?.cancel();
      throw new ErrorDeNegocio('SEACE no devolvió una descarga Excel. Usa el enlace manual de este mes.');
    }
    const bytes = await leer(respuesta, MAX_EXCEL);
    const extension = tipoLibro(bytes);
    const nombre = municipio.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'Municipalidad';
    return { bytes, filename: `Ordenes-y-servicios-${anio}-${String(mes).padStart(2, '0')}-${nombre}${extension}` };
  } catch (error) {
    if (error instanceof ErrorDeNegocio) throw error;
    throw new ErrorDeNegocio('No se pudo conectar con SEACE o se agotó el tiempo. Usa el enlace manual de este mes.');
  } finally { sesiones.delete(usuario); }
}
