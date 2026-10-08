import { enlacesAnualesSeace } from '@/lib/descargas-seace';

type Opciones = { anio: number; ruc: string; municipio: string };

/** Autosuficiente: se serializa en un marcador y se ejecuta solo por acción del usuario en SEACE. */
export async function ejecutarMarcadorSeace(opciones: Opciones) {
  const host = 'https://prod2.seace.gob.pe';
  const ruta = '/seacebus-uiwd-pub/buscadorPublico/ongei/buscadorPublicoOCOS.xhtml';
  if (location.origin !== host || location.pathname !== ruta) {
    alert('Abre primero un mes en SEACE y pulsa este marcador desde esa página.'); return;
  }
  if (!Number.isInteger(opciones.anio) || opciones.anio < 2000 || opciones.anio > new Date().getFullYear() || !/^\d{11}$/.test(opciones.ruc)) {
    alert('El año o RUC del marcador no es válido. Créalo de nuevo desde fiscalizador.'); return;
  }
  if (document.getElementById('fiscalizador-seace-descarga')) {
    alert('Ya hay un panel de descarga abierto. Ciérralo antes de iniciar otro.'); return;
  }
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const clave = `fiscalizador-seace:${opciones.ruc}:${opciones.anio}`;
  let enviados: number[] = [];
  try {
    const previo: unknown = JSON.parse(localStorage.getItem(clave) ?? '[]');
    if (Array.isArray(previo)) enviados = [...new Set(previo.filter(n => Number.isInteger(n) && n >= 1 && n <= 12))];
  } catch { /* El progreso local es opcional. */ }
  let pausar = false;
  const panel = document.createElement('section');
  panel.id = 'fiscalizador-seace-descarga';
  panel.setAttribute('aria-label', 'Descarga anual de fiscalizador');
  Object.assign(panel.style, { position: 'fixed', top: '16px', right: '16px', zIndex: '2147483647', width: '360px', maxWidth: 'calc(100vw - 32px)', maxHeight: '80vh', overflow: 'auto', padding: '20px', border: '2px solid #156044', borderRadius: '12px', background: '#fff', color: '#17251e', boxShadow: '0 8px 32px #0005', font: '14px/1.5 system-ui' });
  const titulo = document.createElement('h2');
  titulo.textContent = `${opciones.municipio} · ${opciones.anio}`;
  const estado = document.createElement('p'); estado.setAttribute('role', 'status');
  const aviso = document.createElement('p');
  aviso.textContent = 'Permite las descargas múltiples de SEACE y revisa Descargas. Los archivos enviados no confirman que el navegador los haya guardado. Mantén esta pestaña abierta y evita otras consultas SEACE mientras descarga.';
  const boton = (texto: string) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = texto;
    Object.assign(b.style, { minHeight: '44px', margin: '4px', padding: '8px 12px', border: '1px solid #156044', borderRadius: '8px', cursor: 'pointer', background: '#f2faf5', color: '#17251e' });
    panel.appendChild(b); return b;
  };
  panel.append(titulo, estado, aviso); document.body.appendChild(panel);
  const pausa = boton('Pausar al terminar este mes'); pausa.onclick = () => { pausar = true; pausa.disabled = true; };
  const cerrar = boton('Cerrar'); cerrar.disabled = true; cerrar.onclick = () => panel.remove();
  const reiniciar = boton('Reiniciar progreso'); reiniciar.disabled = true;
  reiniciar.onclick = () => {
    try { localStorage.removeItem(clave); } catch { /* Sin almacenamiento. */ }
    panel.remove(); alert('Progreso reiniciado. Pulsa otra vez el marcador para repetir las descargas.');
  };
  const leer = async (r: Response, limite: number) => {
    if (!r.ok) { await r.body?.cancel(); throw new Error(`SEACE respondió HTTP ${r.status}. Se detuvo la descarga.`); }
    if (Number(r.headers.get('content-length')) > limite) { await r.body?.cancel(); throw new Error('La respuesta supera el tamaño permitido. Descarga este mes manualmente.'); }
    const reader = r.body?.getReader(); if (!reader) throw new Error('SEACE no devolvió contenido.');
    const partes: Uint8Array[] = []; let cantidad = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        cantidad += value.byteLength;
        if (cantidad > limite) throw new Error('La respuesta supera el tamaño permitido.');
        partes.push(value);
      }
    } finally { await reader.cancel(); }
    const bytes = new Uint8Array(cantidad); let pos = 0;
    for (const parte of partes) { bytes.set(parte, pos); pos += parte.byteLength; }
    return bytes;
  };
  try {
    for (let mes = 1; mes <= 12; mes++) {
      if (pausar) break;
      if (enviados.includes(mes)) continue;
      estado.textContent = `${enviados.length}/12 enviados · consultando ${meses[mes - 1]}…`;
      const url = new URL(ruta, host);
      url.search = new URLSearchParams({ ruc_entidad: opciones.ruc, anio: String(opciones.anio), mes: String(mes).padStart(2, '0'), theme: 'ongei' }).toString();
      const signal = AbortSignal.timeout(45_000);
      const pagina = await fetch(url.href, { credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal });
      const html = new TextDecoder().decode(await leer(pagina, 2 * 1024 * 1024));
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const form = doc.querySelector<HTMLFormElement>('form#formBuscador');
      if (!form || form.getAttribute('method')?.toLowerCase() !== 'post' || new URL(form.getAttribute('action') ?? '', host).href !== host + ruta || !form.querySelector('button[name="formBuscador:btnExportar"]')) throw new Error('No se encontró la exportación esperada. Usa la descarga manual.');
      const nombreMes = mes === 9 ? '(?:SEPTIEMBRE|SETIEMBRE)' : meses[mes - 1];
      if (!new RegExp(`\\b${nombreMes}\\s*-\\s*${opciones.anio}\\b`, 'i').test(doc.documentElement.textContent ?? '')) throw new Error('SEACE devolvió un periodo diferente al solicitado.');
      const campo = (nombre: string) => form.querySelector<HTMLInputElement>(`input[name="${nombre}"]`)?.value;
      const vista = campo('javax.faces.ViewState');
      const busqueda = campo('formBuscador:hddIniciaBusqueda');
      if (campo('formBuscador') !== 'formBuscador' || !vista || busqueda === undefined) throw new Error('Faltan campos del formulario de SEACE.');
      const datos = new URLSearchParams({ formBuscador: 'formBuscador', 'formBuscador:btnExportar': '', 'formBuscador:hddIniciaBusqueda': busqueda, 'javax.faces.ViewState': vista });
      const respuesta = await fetch(host + ruta, { method: 'POST', body: datos.toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, credentials: 'same-origin', referrer: url.href, cache: 'no-store', redirect: 'error', signal });
      if (respuesta.ok && (!/^attachment\b/i.test(respuesta.headers.get('content-disposition') ?? '') || !/^(application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/octet-stream)\b/i.test(respuesta.headers.get('content-type') ?? ''))) {
        await respuesta.body?.cancel(); throw new Error('SEACE devolvió una página en lugar del Excel.');
      }
      const bytes = await leer(respuesta, 25 * 1024 * 1024);
      const ole = [208, 207, 17, 224, 161, 177, 26, 225].every((b, i) => bytes[i] === b);
      const zip = bytes[0] === 80 && bytes[1] === 75;
      if (!ole && !zip) throw new Error('La respuesta no tiene la firma de un archivo Excel.');
      const nombre = opciones.municipio.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 80) || 'Municipalidad';
      const objeto = URL.createObjectURL(new Blob([bytes]));
      const a = document.createElement('a'); a.href = objeto;
      a.download = `Ordenes-y-servicios-${opciones.anio}-${String(mes).padStart(2, '0')}-${nombre}${ole ? '.xls' : '.xlsx'}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(objeto), 1000);
      enviados.push(mes);
      try { localStorage.setItem(clave, JSON.stringify(enviados)); } catch { /* Continuar sin persistencia. */ }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    estado.textContent = `${enviados.length}/12 archivos enviados al navegador.${pausar ? ' Pausado. Cierra este panel y pulsa el marcador para continuar.' : ' Comprueba los archivos en Descargas.'}`;
  } catch (error) {
    estado.textContent = `${enviados.length}/12 enviados. ${error instanceof Error ? error.message : 'No se pudo descargar.'} Cierra el panel y pulsa el marcador para reintentar, o descarga el mes manualmente.`;
  } finally { pausa.disabled = true; cerrar.disabled = false; reiniciar.disabled = false; }
}

export function crearMarcadorSeace(opciones: Opciones) {
  enlacesAnualesSeace(opciones.anio, opciones.ruc);
  if (!opciones.municipio.trim() || opciones.municipio.length > 120) throw new Error('Municipalidad inválida.');
  // Datos JSON y URL codificada: el nombre no se interpola como código ejecutable.
  return `javascript:${encodeURIComponent(`void(${ejecutarMarcadorSeace.toString()}(${JSON.stringify(opciones)}))`)}`;
}
