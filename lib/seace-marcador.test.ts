import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { crearMarcadorSeace } from './seace-marcador';

const opciones = { anio: 2019, ruc: '20146657142', municipio: 'San Ramón' };
function preparar() {
  const descargas: { bytes: Blob; nombre?: string }[] = [];
  const nodos: { id?: string; textContent?: string; disabled?: boolean; download?: string; children: unknown[]; style: object; setAttribute: ReturnType<typeof vi.fn>; append: (...n: unknown[]) => void; appendChild: (n: unknown) => unknown; remove: ReturnType<typeof vi.fn>; click: ReturnType<typeof vi.fn> }[] = [];
  const document = {
    getElementById: (id: string) => nodos.find(n => n.id === id),
    createElement: () => {
      const node: typeof nodos[number] = { children: [], style: {}, setAttribute: vi.fn(), append(...n) { this.children.push(...n); }, appendChild(n) { this.children.push(n); return n; }, remove: vi.fn(), click: vi.fn() };
      node.click.mockImplementation(() => { if (node.download) descargas[descargas.length - 1].nombre = node.download; });
      nodos.push(node); return node;
    },
    body: { appendChild: vi.fn() },
  };
  const fetchMock = vi.fn();
  class Url extends URL {
    static createObjectURL(blob: Blob) { descargas.push({ bytes: blob }); return 'blob:prueba'; }
    static revokeObjectURL() {}
  }
  class Parser {
    parseFromString(texto: string) {
      const datos = JSON.parse(texto);
      const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const form = { getAttribute: (a: string) => a === 'method' ? 'post' : '/seacebus-uiwd-pub/buscadorPublico/ongei/buscadorPublicoOCOS.xhtml', querySelector: (s: string) => {
        if (s.startsWith('button')) return {};
        if (s.includes('javax.faces.ViewState')) return { value: datos.vista };
        if (s.includes('hddIniciaBusqueda')) return { value: '' };
        return { value: 'formBuscador' };
      } };
      return { querySelector: () => form, documentElement: { textContent: `${meses[datos.mes - 1]} - 2019` } };
    }
  }
  const contexto = { location: { origin: 'https://prod2.seace.gob.pe', pathname: '/seacebus-uiwd-pub/buscadorPublico/ongei/buscadorPublicoOCOS.xhtml' }, document, alert: vi.fn(), localStorage: { getItem: vi.fn((): string | null => null), setItem: vi.fn(), removeItem: vi.fn() }, fetch: fetchMock, URL: Url, URLSearchParams, DOMParser: Parser, TextDecoder, Uint8Array, Blob, AbortSignal, setTimeout: (fn: () => void) => { fn(); return 0; } };
  const iniciar = () => runInNewContext(decodeURIComponent(crearMarcadorSeace(opciones).slice('javascript:'.length)), contexto);
  const esperar = () => vi.waitFor(() => expect(nodos.find(n => n.textContent === 'Cerrar')?.disabled).toBe(false));
  return { contexto, fetchMock, descargas, nodos, iniciar, esperar };
}
describe('marcador de descarga en el navegador del administrador', () => {
  it('contiene código autosuficiente y no ejecuta en fiscalizador ni en otros sitios', () => {
    const prueba = preparar(); prueba.contexto.location.origin = 'https://fiscalizador.onrender.com';
    prueba.iniciar(); expect(prueba.contexto.alert).toHaveBeenCalled(); expect(prueba.fetchMock).not.toHaveBeenCalled();
  });
  it('descarga los doce originales con estado nuevo, cookies del navegador y sin conexiones a Render', async () => {
    const original = await readFile('docs/reference/Lista-OCOS-2023-06.xls');
    const p = preparar();
    p.fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (init.method !== 'POST') {
        const mes = Number(new URL(url).searchParams.get('mes'));
        return new Response(JSON.stringify({ mes, vista: `estado-${mes}` }));
      }
      return new Response(original, { headers: { 'Content-Disposition': 'attachment;filename=Lista-OCOS.xls', 'Content-Type': 'application/vnd.ms-excel' } });
    });
    p.iniciar(); await p.esperar();
    expect(p.fetchMock).toHaveBeenCalledTimes(24);
    expect(p.descargas).toHaveLength(12);
    const hash = createHash('sha256').update(original).digest('hex');
    for (let i = 0; i < 12; i++) {
      expect(createHash('sha256').update(Buffer.from(await p.descargas[i].bytes.arrayBuffer())).digest('hex')).toBe(hash);
      expect(p.descargas[i].nombre).toContain(`2019-${String(i + 1).padStart(2, '0')}-San-Ramon.xls`);
      const [url, init] = p.fetchMock.mock.calls[i * 2 + 1];
      expect(new URL(url).hostname).toBe('prod2.seace.gob.pe');
      expect(init.credentials).toBe('same-origin');
      expect(new URLSearchParams(init.body).get('javax.faces.ViewState')).toBe(`estado-${i + 1}`);
      expect(new URLSearchParams(init.body).get('formBuscador:btnExportar')).toBe('');
      expect(init.headers.Cookie).toBeUndefined();
    }
  });
  it('detiene un 403 sin guardar progreso ni lanzar los otros once meses', async () => {
    const p = preparar(); p.fetchMock.mockResolvedValue(new Response('Forbidden', { status: 403 }));
    p.iniciar(); await p.esperar();
    expect(p.fetchMock).toHaveBeenCalledTimes(1);
    expect(p.descargas).toHaveLength(0);
    expect(p.contexto.localStorage.setItem).not.toHaveBeenCalled();
    expect(p.nodos.some(n => n.textContent?.includes('HTTP 403'))).toBe(true);
  });
  it('omite los meses enviados previamente al continuar', async () => {
    const p = preparar(); p.contexto.localStorage.getItem.mockReturnValue('[1,2]');
    p.fetchMock.mockResolvedValue(new Response('Forbidden', { status: 403 }));
    p.iniciar(); await p.esperar();
    expect(new URL(p.fetchMock.mock.calls[0][0]).searchParams.get('mes')).toBe('03');
  });
  it('serializa el nombre como datos y rechaza años o RUC inválidos', () => {
    const codigo = decodeURIComponent(crearMarcadorSeace({ ...opciones, municipio: '");alert("NO");//' }).slice(11));
    expect(() => new Function(codigo)).not.toThrow();
    expect(() => crearMarcadorSeace({ ...opciones, ruc: '../otro' })).toThrow();
    expect(() => crearMarcadorSeace({ ...opciones, anio: 2100 })).toThrow();
  });
});
