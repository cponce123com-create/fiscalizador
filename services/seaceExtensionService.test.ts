import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext, createContext, runInContext } from 'node:vm';
import { inflateRawSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { paqueteExtensionSeace } from '@/services/seaceExtensionService';
import { SEACE_EXTENSION_ID } from '@/lib/seace-extension-id';

const BASE = 'https://prod2.seace.gob.pe/seacebus-uiwd-pub/buscadorPublico/ongei/buscadorPublicoOCOS.xhtml';
const codigo = readFileSync('browser-extension/seace/runner.js', 'utf8');
type Listener = (...args: unknown[]) => void;
function evento() {
  const listeners = new Set<Listener>();
  return { addListener: (fn: Listener) => listeners.add(fn), removeListener: (fn: Listener) => listeners.delete(fn), emit: (...args: unknown[]) => { for (const fn of listeners) fn(...args); } };
}
function excel(mes: number) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Número de orden', 'Fecha de Emisión', 'Monto'], ['641', `2018-${String(mes).padStart(2, '0')}-03 00:00:00.0`, 'S/. 100']]), 'Sheet0');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'biff8' }));
}

function navegador({ devolverDiciembre = false, detenerPrimera = false, otraPestana = false, interrumpir = false, httpError = false } = {}) {
  const nodos = new Map<string, { value: string | number; max?: string; textContent: string; disabled: boolean; children: unknown[]; addEventListener: ReturnType<typeof vi.fn>; querySelectorAll: () => unknown[]; replaceChildren: () => void; appendChild: (n: unknown) => void }>();
  for (const id of ['estado', 'iniciar', 'cancelar', 'progreso', 'archivos', 'configuracion', 'anio', 'ruc', 'municipio']) nodos.set(id, { value: '', textContent: '', disabled: false, children: [], addEventListener: vi.fn(), querySelectorAll: () => ['anio', 'ruc', 'municipio'].map(k => nodos.get(k)), replaceChildren() { this.children = []; }, appendChild(n) { this.children.push(n); } });
  const actualizaciones = evento(); const cambios = evento();
  const blobs = new Map<string, Blob>();
  const guardados: { id: number; nombre: string; blob: Blob }[] = [];
  const estados = new Map<number, string>();
  const solicitudes: { mes: number; vista: string | null }[] = [];
  const navegaciones: string[] = [];
  let urlActual = ''; let objectId = 0;
  const chrome = {
    tabs: {
      query: vi.fn(async () => otraPestana ? [{ id: 999 }] : []),
      create: vi.fn(async () => ({ id: 7 })),
      remove: vi.fn(async () => {}),
      update: vi.fn(async (_id: number, datos: { url: string }) => { urlActual = datos.url; navegaciones.push(urlActual); queueMicrotask(() => actualizaciones.emit(7, { status: 'complete' })); }),
      onUpdated: actualizaciones,
    },
    scripting: {
      executeScript: vi.fn(async ({ func, args }: { func: () => unknown; args: [number, number, string, string] }) => {
        const mes = args[1];
        const campos: Record<string, string> = { formBuscador: 'formBuscador', 'formBuscador:hddIniciaBusqueda': '', 'javax.faces.ViewState': `vista-${mes}` };
        const form = { method: 'post', getAttribute: () => BASE, querySelector: (selector: string) => selector.startsWith('button') ? {} : { value: campos[selector.match(/name="([^"]+)"/)![1]] } };
        const result = await runInNewContext('(' + func.toString() + ')(...args)', {
          args, location: { href: urlActual }, document: { body: { textContent: args[3] + ' - 2018' }, querySelector: () => form }, URL, URLSearchParams, AbortSignal, Uint8Array, btoa,
          fetch: async (_url: string, init: { body: string }) => {
            solicitudes.push({ mes, vista: new URLSearchParams(init.body).get('javax.faces.ViewState') });
            return new Response(httpError ? 'Forbidden' : excel(devolverDiciembre ? 12 : mes), { status: httpError ? 403 : 200, headers: { 'content-type': 'application/vnd.ms-excel', 'content-disposition': 'attachment;filename=Lista-OCOS.xls' } });
          },
        });
        return [{ result }];
      }),
    },
    downloads: {
      onChanged: cambios,
      download: vi.fn(async ({ url, filename }: { url: string; filename: string }) => {
        const id = guardados.length + 1;
        guardados.push({ id, nombre: filename, blob: blobs.get(url)! }); estados.set(id, 'in_progress');
        if (!(detenerPrimera && id === 1)) queueMicrotask(() => { estados.set(id, interrumpir ? 'interrupted' : 'complete'); cambios.emit({ id, state: { current: interrumpir ? 'interrupted' : 'complete' } }); });
        return id;
      }),
      search: vi.fn(async ({ id }: { id: number }) => [{ state: estados.get(id) }]),
    },
  };
  class Url extends URL {
    static createObjectURL(blob: Blob) { const url = 'blob:extension/' + (++objectId); blobs.set(url, blob); return url; }
    static revokeObjectURL(url: string) { blobs.delete(url); }
  }
  const contexto = createContext({ chrome, URL: Url, URLSearchParams, Blob, Uint8Array, Date, Number, String, crypto: globalThis.crypto, atob, setTimeout, clearTimeout, XLSX, location: { href: 'chrome-extension://descargador/runner.html' }, document: { getElementById: (id: string) => nodos.get(id), createElement: () => ({ textContent: '' }) } });
  runInContext(codigo, contexto);
  return { chrome, guardados, solicitudes, navegaciones, nodos, run: () => runInContext("descargar({ anio: 2018, ruc: '20146657142', municipio: 'San Ramón' })", contexto) as Promise<void>, completar: () => { estados.set(1, 'complete'); cambios.emit({ id: 1, state: { current: 'complete' } }); }, completarAjeno: () => cambios.emit({ id: 999, state: { current: 'complete' } }) };
}

describe('descarga anual real orquestada por Chrome', () => {
  it('espera el guardado real, obtiene un estado nuevo por mes y conserva los bytes originales de los doce Excel', async () => {
    const n = navegador({ detenerPrimera: true }); const tarea = n.run();
    await vi.waitFor(() => expect(n.guardados).toHaveLength(1));
    expect(n.navegaciones).toHaveLength(1);
    n.completarAjeno(); await new Promise(r => setTimeout(r, 10));
    expect(n.navegaciones).toHaveLength(1);
    n.completar(); await tarea;
    expect(n.guardados).toHaveLength(12); expect(n.chrome.tabs.create).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 12; i++) {
      const mes = i + 1;
      expect(new URL(n.navegaciones[i]).searchParams.get('mes')).toBe(String(mes).padStart(2, '0'));
      expect(n.solicitudes[i]).toEqual({ mes, vista: `vista-${mes}` });
      expect(n.guardados[i].nombre).toBe(`Ordenes-y-servicios-2018-${String(mes).padStart(2, '0')}-San-Ramon.xls`);
      const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
      expect(hash(Buffer.from(await n.guardados[i].blob.arrayBuffer()))).toBe(hash(excel(mes)));
    }
    expect(n.nodos.get('estado')?.textContent).toContain('12/12 Excel guardados');
  });
  it('si enero devuelve diciembre, no guarda un archivo mal etiquetado ni pasa a febrero', async () => {
    const n = navegador({ devolverDiciembre: true }); await n.run();
    expect(n.guardados).toHaveLength(0); expect(n.navegaciones).toHaveLength(1);
    expect(n.nodos.get('estado')?.textContent).toContain('Se solicitó 2018-01 pero el Excel contiene 2018-12');
  });
  it('un error HTTP o una descarga interrumpida no cuenta como guardado ni abre otro mes', async () => {
    for (const opciones of [{ httpError: true }, { interrumpir: true }]) {
      const n = navegador(opciones); await n.run();
      expect(n.navegaciones).toHaveLength(1);
      expect(n.nodos.get('progreso')?.value).toBe(0);
    }
  });
  it('rechaza las consultas concurrentes antes de abrir su pestaña', async () => {
    const n = navegador({ otraPestana: true }); await n.run();
    expect(n.chrome.tabs.create).not.toHaveBeenCalled(); expect(n.guardados).toHaveLength(0);
    expect(n.nodos.get('estado')?.textContent).toContain('Cierra las otras pestañas');
  });
});

describe('paquete instalable', () => {
  it('incluye código local, licencia y un manifest MV3 con ID estable y permisos acotados', async () => {
    const zip = await paqueteExtensionSeace();
    const archivos = new Map<string, Buffer>(); let pos = 0;
    while (zip.readUInt32LE(pos) === 0x04034b50) {
      const longitud = zip.readUInt32LE(pos + 18); const nombreLen = zip.readUInt16LE(pos + 26); const extra = zip.readUInt16LE(pos + 28);
      const nombre = zip.subarray(pos + 30, pos + 30 + nombreLen).toString();
      const inicio = pos + 30 + nombreLen + extra;
      archivos.set(nombre, inflateRawSync(zip.subarray(inicio, inicio + longitud))); pos = inicio + longitud;
    }
    expect([...archivos.keys()]).toEqual(['manifest.json', 'background.js', 'runner.html', 'runner.css', 'runner.js', 'LEEME.txt', 'xlsx.full.min.js', 'SHEETJS-LICENSE.txt']);
    const manifest = JSON.parse(archivos.get('manifest.json')!.toString());
    const id = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex').slice(0, 32).replace(/[0-9a-f]/g, c => 'abcdefghijklmnop'[parseInt(c, 16)]);
    expect(id).toBe(SEACE_EXTENSION_ID);
    expect(manifest.permissions).toEqual(['scripting', 'downloads']);
    expect(manifest.host_permissions).toEqual(['https://prod2.seace.gob.pe/*']);
    expect(manifest.manifest_version).toBe(3);
    expect(archivos.get('runner.js')?.toString()).toBe(codigo);
    expect(archivos.get('xlsx.full.min.js')?.equals(readFileSync('node_modules/xlsx/dist/xlsx.full.min.js'))).toBe(true);
  });
});
