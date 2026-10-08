const BASE = 'https://prod2.seace.gob.pe/seacebus-uiwd-pub/buscadorPublico/ongei/buscadorPublicoOCOS.xhtml';
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const estado = document.getElementById('estado');
const iniciar = document.getElementById('iniciar');
const cancelar = document.getElementById('cancelar');
const progreso = document.getElementById('progreso');
const lista = document.getElementById('archivos');
const formulario = document.getElementById('configuracion');
let trabajando = false;
let detener = false;
let clave = '';
const completados = new Set();
const huellas = new Map();

// Autosuficiente: Chrome ejecuta esta función en la página real y recién cargada de SEACE.
async function exportarEnSeace(anio, mes, ruc, nombreMes) {
  try {
    const base = 'https://prod2.seace.gob.pe/seacebus-uiwd-pub/buscadorPublico/ongei/buscadorPublicoOCOS.xhtml';
    const url = new URL(location.href);
    if (url.origin + url.pathname !== base || url.searchParams.get('anio') !== String(anio) || Number(url.searchParams.get('mes')) !== mes || url.searchParams.get('ruc_entidad') !== ruc) throw new Error('SEACE no está en la consulta solicitada.');
    const patronMes = mes === 9 ? '(?:SEPTIEMBRE|SETIEMBRE)' : nombreMes;
    if (!new RegExp('\\b' + patronMes + '\\s*-\\s*' + anio + '\\b', 'i').test(document.body.textContent)) throw new Error('La página no confirma el periodo solicitado. Puede requerir una comprobación manual de SEACE.');
    const form = document.querySelector('form#formBuscador');
    if (!form || form.method.toLowerCase() !== 'post' || new URL(form.getAttribute('action'), location.href).href !== base || !form.querySelector('button[name="formBuscador:btnExportar"]')) throw new Error('No se encontró el formulario de exportación esperado.');
    const campo = nombre => form.querySelector('input[name="' + nombre + '"]')?.value;
    const vista = campo('javax.faces.ViewState');
    const busqueda = campo('formBuscador:hddIniciaBusqueda');
    if (campo('formBuscador') !== 'formBuscador' || !vista || busqueda === undefined) throw new Error('Faltan campos de exportación.');
    const datos = new URLSearchParams({ formBuscador: 'formBuscador', 'formBuscador:btnExportar': '', 'formBuscador:hddIniciaBusqueda': busqueda, 'javax.faces.ViewState': vista });
    const r = await fetch(base, { method: 'POST', body: datos.toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(60000) });
    const limite = 25 * 1024 * 1024;
    if (!r.ok || !/^attachment\b/i.test(r.headers.get('content-disposition') ?? '') || !/^(application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/octet-stream)\b/i.test(r.headers.get('content-type') ?? '') || Number(r.headers.get('content-length')) > limite) {
      await r.body?.cancel(); throw new Error('SEACE no entregó un Excel válido (HTTP ' + r.status + ').');
    }
    const reader = r.body?.getReader(); if (!reader) throw new Error('La respuesta está vacía.');
    const partes = []; let cantidad = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        cantidad += value.byteLength; if (cantidad > limite) throw new Error('El libro supera 25 MB.');
        partes.push(value);
      }
    } finally { await reader.cancel(); }
    const bytes = new Uint8Array(cantidad); let posicion = 0;
    for (const parte of partes) { bytes.set(parte, posicion); posicion += parte.byteLength; }
    const ole = [208, 207, 17, 224, 161, 177, 26, 225].every((n, i) => bytes[i] === n);
    if (!ole && !(bytes[0] === 80 && bytes[1] === 75)) throw new Error('El contenido no tiene firma de Excel.');
    let binario = '';
    for (let i = 0; i < bytes.length; i += 32768) binario += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return { base64: btoa(binario), extension: ole ? 'xls' : 'xlsx' };
  } catch (error) { return { error: error.message }; }
}

function cargarMes(tabId, url) {
  return new Promise((resolve, reject) => {
    const terminar = error => {
      clearTimeout(timer); chrome.tabs.onUpdated.removeListener(cambio);
      if (error) reject(error); else resolve();
    };
    const cambio = (id, info) => { if (id === tabId && info.status === 'complete') terminar(); };
    const timer = setTimeout(() => terminar(new Error('SEACE tardó demasiado en cargar el mes.')), 60000);
    chrome.tabs.onUpdated.addListener(cambio);
    chrome.tabs.update(tabId, { url }).catch(terminar);
  });
}

/** El siguiente mes espera un estado COMPLETE real de Chrome, no un clic ni un temporizador. */
function guardarExcel(bytes, extension, nombre) {
  return new Promise((resolve, reject) => {
    let id = null;
    let acabado = false;
    const objeto = URL.createObjectURL(new Blob([bytes], { type: extension === 'xls' ? 'application/vnd.ms-excel' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const terminar = error => {
      if (acabado) return; acabado = true;
      clearTimeout(timer); chrome.downloads.onChanged.removeListener(cambio); URL.revokeObjectURL(objeto);
      if (error) reject(error); else resolve();
    };
    const cambio = delta => {
      if (delta.id !== id) return;
      if (delta.state?.current === 'complete') terminar();
      else if (delta.state?.current === 'interrupted' || delta.error) terminar(new Error('Chrome interrumpió el Excel: ' + (delta.error?.current ?? 'descarga interrumpida')));
    };
    const timer = setTimeout(() => terminar(new Error('Chrome no confirmó el guardado. Revisa Descargas antes de reintentar.')), 300000);
    chrome.downloads.onChanged.addListener(cambio);
    chrome.downloads.download({ url: objeto, filename: nombre, conflictAction: 'uniquify', saveAs: false }).then(async downloadId => {
      id = downloadId;
      const [item] = await chrome.downloads.search({ id });
      if (item?.state === 'complete') terminar();
      else if (item?.state === 'interrupted') terminar(new Error('Chrome interrumpió la descarga.'));
    }).catch(terminar);
  });
}

function revisarPeriodo(bytes, esperado) {
  const wb = XLSX.read(bytes, { cellDates: true, raw: true });
  const hoja = wb.Sheets[wb.SheetNames[0]];
  if (!hoja) throw new Error('El Excel no tiene hojas.');
  const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: null });
  const normalizar = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const encabezado = filas.slice(0, 20).findIndex(f => f.some(c => ['fecha de emision', 'fecha emision'].includes(normalizar(c))));
  if (encabezado < 0) throw new Error('No se encontró la fecha de emisión para comprobar el Excel.');
  const columna = filas[encabezado].findIndex(c => ['fecha de emision', 'fecha emision'].includes(normalizar(c)));
  const registros = filas.slice(encabezado + 1).filter(f => f.some(c => c !== null && c !== ''));
  const periodos = new Set();
  for (const fila of registros) {
    const valor = fila[columna];
    if (valor instanceof Date && !Number.isNaN(valor.getTime())) { periodos.add(valor.toISOString().slice(0, 7)); continue; }
    const texto = String(valor ?? '').trim();
    const iso = /^(\d{4})-(\d{2})-\d{2}(?:\s|$)/.exec(texto);
    const dma = /^\d{1,2}[/-](\d{1,2})[/-](\d{4})(?:\s|$)/.exec(texto);
    if (iso) periodos.add(iso[1] + '-' + iso[2]);
    else if (dma) periodos.add(dma[2] + '-' + dma[1].padStart(2, '0'));
  }
  if (registros.length && !periodos.has(esperado)) throw new Error('Se solicitó ' + esperado + ' pero el Excel contiene ' + ([...periodos].join(', ') || 'fechas no legibles') + '. Se detuvo antes de guardar un mes incorrecto.');
  return { filas: registros.length, mezcla: periodos.size > 1 };
}

async function descargar(opciones) {
  if (trabajando) return;
  const { anio, ruc, municipio } = opciones;
  if (!Number.isInteger(anio) || anio < 2000 || anio > new Date().getFullYear() || !/^\d{11}$/.test(ruc) || !municipio.trim() || municipio.length > 120) { estado.textContent = 'Revisa año, RUC y municipalidad.'; return; }
  trabajando = true; detener = false; iniciar.disabled = true; cancelar.disabled = false;
  for (const input of formulario.querySelectorAll('input')) input.disabled = true;
  let tabId = null;
  if (clave !== anio + ':' + ruc) { clave = anio + ':' + ruc; completados.clear(); huellas.clear(); lista.replaceChildren(); }
  progreso.value = completados.size;
  try {
    const otras = await chrome.tabs.query({ url: 'https://prod2.seace.gob.pe/*' });
    if (otras.length) throw new Error('Cierra las otras pestañas de SEACE y pulsa Descargar los 12 Excel de nuevo.');
    tabId = (await chrome.tabs.create({ url: 'about:blank', active: false })).id;
    for (let mes = 1; mes <= 12; mes++) {
      if (detener) break;
      if (completados.has(mes)) continue;
      const abiertas = await chrome.tabs.query({ url: 'https://prod2.seace.gob.pe/*' });
      if (abiertas.some(t => t.id !== tabId)) throw new Error('Se abrió otra consulta de SEACE. Ciérrala antes de continuar para evitar meses cruzados.');
      const periodo = anio + '-' + String(mes).padStart(2, '0');
      estado.textContent = completados.size + '/12 guardados · consultando ' + MESES[mes - 1] + ' ' + anio + '…';
      const url = new URL(BASE); url.search = new URLSearchParams({ ruc_entidad: ruc, anio: String(anio), mes: String(mes).padStart(2, '0'), theme: 'ongei' }).toString();
      await cargarMes(tabId, url.href);
      const [resultado] = await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func: exportarEnSeace, args: [anio, mes, ruc, MESES[mes - 1]] });
      const dato = resultado?.result;
      if (!dato || dato.error) throw new Error(dato?.error ?? 'SEACE no devolvió el Excel.');
      const bytes = Uint8Array.from(atob(dato.base64), c => c.charCodeAt(0));
      const revision = revisarPeriodo(bytes, periodo);
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
      if (revision.filas && huellas.has(hash)) throw new Error('SEACE repitió el archivo de ' + huellas.get(hash) + '. No se guardó como ' + periodo + '.');
      const nombreMunicipio = municipio.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 80) || 'Municipalidad';
      const nombre = 'Ordenes-y-servicios-' + periodo + '-' + nombreMunicipio + '.' + dato.extension;
      estado.textContent = completados.size + '/12 guardados · esperando que Chrome termine ' + MESES[mes - 1] + '…';
      await guardarExcel(bytes, dato.extension, nombre);
      completados.add(mes); if (revision.filas) huellas.set(hash, periodo); progreso.value = completados.size;
      const item = document.createElement('li'); item.textContent = nombre + ' · ' + revision.filas + ' filas' + (revision.mezcla ? ' · contiene fechas de varios meses; revisar al importar' : ''); lista.appendChild(item);
    }
    estado.textContent = completados.size + '/12 Excel guardados.' + (detener ? ' Detenido. Pulsa Descargar los 12 Excel para continuar con los pendientes.' : ' Revisa Descargas y súbelos al importador.');
  } catch (error) { estado.textContent = completados.size + '/12 guardados. ' + error.message + ' Los meses pendientes se pueden reintentar con el mismo botón.'; }
  finally {
    if (tabId !== null) await chrome.tabs.remove(tabId).catch(() => {});
    trabajando = false; iniciar.disabled = false; cancelar.disabled = true;
    for (const input of formulario.querySelectorAll('input')) input.disabled = false;
  }
}

const params = new URL(location.href).searchParams;
document.getElementById('anio').value = params.get('anio') ?? String(new Date().getFullYear() - 1);
document.getElementById('anio').max = String(new Date().getFullYear());
document.getElementById('ruc').value = params.get('ruc') ?? '20146657142';
document.getElementById('municipio').value = params.get('municipio') ?? 'Municipalidad Distrital de San Ramón';
const opciones = () => ({ anio: Number(document.getElementById('anio').value), ruc: document.getElementById('ruc').value, municipio: document.getElementById('municipio').value.trim() });
formulario.addEventListener('submit', evento => { evento.preventDefault(); void descargar(opciones()); });
cancelar.addEventListener('click', () => { detener = true; cancelar.disabled = true; });
if (params.has('anio')) void descargar(opciones());
