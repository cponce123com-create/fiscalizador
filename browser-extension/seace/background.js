// Únicamente el panel autorizado puede iniciar una descarga desde una web.
let abriendo = false;
let runnerId = null;
async function abrir(opciones) {
  if (abriendo) throw new Error('Ya se está abriendo el descargador.');
  abriendo = true;
  try {
    const contextos = await chrome.runtime.getContexts({ contextTypes: ['TAB'] });
    const previo = contextos.find(c => c.documentUrl?.startsWith(chrome.runtime.getURL('runner.html')));
    if (previo) { await chrome.tabs.update(previo.tabId, { active: true }); throw new Error('El descargador ya está abierto. Continúa allí o ciérralo antes de iniciar otro año.'); }
    if (runnerId !== null) {
      const tab = await chrome.tabs.get(runnerId).catch(() => null);
      if (tab) throw new Error('El descargador ya está abierto.');
    }
    const url = new URL(chrome.runtime.getURL('runner.html'));
    if (opciones) for (const clave of ['anio', 'ruc', 'municipio']) url.searchParams.set(clave, String(opciones[clave]));
    runnerId = (await chrome.tabs.create({ url: url.href })).id;
  } finally { abriendo = false; }
}
chrome.runtime.onMessageExternal.addListener((mensaje, sender, responder) => {
  try {
    const url = new URL(sender.url);
    if (!['https://fiscalizador.onrender.com', 'http://localhost:3000'].includes(url.origin) || url.pathname !== '/admin/descargas') return;
    if (mensaje?.accion !== 'descargar-anio' || !Number.isInteger(mensaje.anio) || mensaje.anio < 2000 || mensaje.anio > new Date().getFullYear() || !/^\d{11}$/.test(mensaje.ruc) || typeof mensaje.municipio !== 'string' || !mensaje.municipio.trim() || mensaje.municipio.length > 120) {
      responder({ ok: false, error: 'Año, RUC o municipalidad inválidos.' }); return;
    }
    abrir(mensaje).then(() => responder({ ok: true }), error => responder({ ok: false, error: error.message }));
    return true;
  } catch { responder({ ok: false, error: 'Solicitud no válida.' }); }
});
chrome.action.onClicked.addListener(() => { void abrir().catch(() => {}); });
