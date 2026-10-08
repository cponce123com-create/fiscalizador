import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const mensaje = { accion: 'descargar-anio', anio: 2018, ruc: '20146657142', municipio: 'San Ramón' };
function controlador() {
  let listener: (dato: unknown, sender: { url: string }, responder: (r: unknown) => void) => unknown = () => {};
  const create = vi.fn(async () => ({ id: 4 }));
  runInNewContext(readFileSync('browser-extension/seace/background.js', 'utf8'), {
    URL, Date, Number, String,
    chrome: {
      runtime: { getContexts: async () => [], getURL: (p: string) => 'chrome-extension://id/' + p, onMessageExternal: { addListener: (fn: typeof listener) => { listener = fn; } } },
      tabs: { create, get: async () => ({ id: 4 }), update: vi.fn() },
      action: { onClicked: { addListener: vi.fn() } },
    },
  });
  return { create, enviar: (url: string, dato: unknown = mensaje) => {
    const responder = vi.fn(); listener(dato, { url }, responder); return responder;
  } };
}
describe('órdenes externas al descargador', () => {
  it('solo acepta el panel autorizado y rechaza parámetros inválidos sin abrir pestañas', () => {
    const c = controlador();
    c.enviar('https://malicioso.test/admin/descargas');
    c.enviar('https://fiscalizador.onrender.com/proveedores');
    const respuesta = c.enviar('https://fiscalizador.onrender.com/admin/descargas', { ...mensaje, ruc: '123&mes=12' });
    expect(respuesta).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
    expect(c.create).not.toHaveBeenCalled();
  });
  it('pasa datos codificados al descargador y evita iniciar dos simultáneos', async () => {
    const c = controlador();
    const primero = c.enviar('https://fiscalizador.onrender.com/admin/descargas');
    const segundo = c.enviar('https://fiscalizador.onrender.com/admin/descargas');
    await vi.waitFor(() => expect(primero).toHaveBeenCalledWith({ ok: true }));
    expect(segundo).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
    expect(c.create).toHaveBeenCalledTimes(1);
    const url = new URL((c.create.mock.calls[0] as unknown as [{ url: string }])[0].url);
    expect(url.protocol).toBe('chrome-extension:');
    expect(url.searchParams.get('anio')).toBe('2018');
    expect(url.searchParams.get('ruc')).toBe('20146657142');
    expect(url.searchParams.get('municipio')).toBe('San Ramón');
  });
});
