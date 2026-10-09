const PANEL_ADMIN = '/admin';

/**
 * Acepta solo destinos internos del panel.
 *
 * No usa una lista rígida porque el admin tiene rutas dinámicas; en cambio bloquea
 * URLs absolutas, rutas ambiguas y patrones habituales de redirección abierta.
 */
export function validarCallbackAdmin(valor: unknown): string {
  if (typeof valor !== 'string') return PANEL_ADMIN;

  const ruta = valor.trim();
  if (!ruta.startsWith(PANEL_ADMIN)) return PANEL_ADMIN;
  if (ruta.startsWith('//') || ruta.includes('\\') || ruta.includes('..')) return PANEL_ADMIN;
  if (/[\r\n]/.test(ruta)) return PANEL_ADMIN;

  try {
    const url = new URL(ruta, 'https://fiscalizador.local');
    if (url.origin !== 'https://fiscalizador.local') return PANEL_ADMIN;
    if (!url.pathname.startsWith(PANEL_ADMIN)) return PANEL_ADMIN;

    return `${url.pathname}${url.search}`;
  } catch {
    return PANEL_ADMIN;
  }
}
