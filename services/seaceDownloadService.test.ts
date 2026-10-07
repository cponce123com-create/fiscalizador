import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const config = vi.hoisted(() => ({ STORAGE_LOCAL_DIR: '' }));
vi.mock('@/lib/env', () => ({ env: config }));
import { crearDescarga, descargarMes, eliminarDescarga, extensionLibro, obtenerDescarga, seaceConfigurado, ultimaDescarga, validarPeriodo, zipDescarga } from './seaceDownloadService';

// Leer el directorio central del ZIP para comprobar los bytes de sus entradas.
function extraer(zip: Buffer): Map<string, Buffer> {
  const eocd = zip.lastIndexOf(Buffer.from('504b0506', 'hex'));
  let posicion = zip.readUInt32LE(eocd + 16);
  const entradas = new Map<string, Buffer>();
  for (let n = 0; n < zip.readUInt16LE(eocd + 10); n++) {
    const largo = zip.readUInt16LE(posicion + 28);
    const nombre = zip.subarray(posicion + 46, posicion + 46 + largo).toString();
    const local = zip.readUInt32LE(posicion + 42);
    const inicio = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const contenido = zip.subarray(inicio, inicio + zip.readUInt32LE(posicion + 20));
    entradas.set(nombre, zip.readUInt16LE(posicion + 10) === 8 ? inflateRawSync(contenido) : contenido);
    posicion += 46 + largo + zip.readUInt16LE(posicion + 30) + zip.readUInt16LE(posicion + 32);
  }
  return entradas;
}
describe('descargas anuales privadas y separadas del importador', () => {
  let raiz: string;
  const fetchMock = vi.fn();
  beforeEach(async () => {
    raiz = await mkdtemp(path.join(tmpdir(), 'seace-admin-'));
    config.STORAGE_LOCAL_DIR = path.join(raiz, 'uploads');
    vi.stubEnv('SEACE_WORKER_URL', 'http://localhost:8080/');
    vi.stubEnv('SEACE_WORKER_TOKEN', 't'.repeat(64));
    vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset();
  });
  afterEach(async () => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); await rm(raiz, { recursive: true, force: true }); });
  it('no inicia sin configuración y rechaza años futuros y meses inválidos', async () => {
    vi.stubEnv('SEACE_WORKER_TOKEN', ''); expect(seaceConfigurado()).toBe(false);
    await expect(crearDescarga('admin', 2015)).rejects.toThrow(/configura/i);
    expect(() => validarPeriodo(new Date().getFullYear() + 1)).toThrow();
    expect(() => validarPeriodo(2015, 13)).toThrow();
    expect(() => validarPeriodo(2015, 0)).toThrow();
    expect(() => validarPeriodo(2015.5)).toThrow();
  });
  it('impide URLs con credenciales o HTTP hacia servidores públicos', () => {
    for (const url of ['http://example.com/', 'https://user:pass@example.com/', 'https://example.com/?token=x']) {
      vi.stubEnv('SEACE_WORKER_URL', url); expect(seaceConfigurado()).toBe(false);
    }
  });
  it('acepta el nombre interno de Render sin inventar un sufijo .internal', () => {
    vi.stubEnv('SEACE_WORKER_URL', 'http://seace-worker-ab12:8080/');
    expect(seaceConfigurado()).toBe(true);
  });
  it('recupera progreso propio y no expone una descarga a otro usuario', async () => {
    const dato = await crearDescarga('admin', 2015);
    expect(dato.meses).toHaveLength(12);
    expect(await ultimaDescarga('admin')).toEqual(dato);
    await expect(obtenerDescarga('otro', dato.id)).rejects.toThrow(/no encontrada/);
    await expect(obtenerDescarga('admin', '../../etc/passwd')).rejects.toThrow();
    await expect(crearDescarga('admin', 2016)).rejects.toThrow(/Ya tienes/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('marca 403 y HTML como errores, permite reintentar y conserva Excel original en ZIP', async () => {
    const dato = await crearDescarga('admin', 2015);
    fetchMock.mockResolvedValueOnce(new Response('403', { status: 422 }));
    expect((await descargarMes('admin', dato.id, 1)).meses[0].estado).toBe('error');
    fetchMock.mockResolvedValueOnce(new Response('<html>CAPTCHA</html>'));
    expect((await descargarMes('admin', dato.id, 1)).meses[0].estado).toBe('error');
    const original = await readFile('docs/reference/Lista-OCOS-2023-06.xls');
    fetchMock.mockResolvedValueOnce(new Response(original));
    const completo = await descargarMes('admin', dato.id, 1);
    expect(completo.meses[0]).toMatchObject({ estado: 'descargado', bytes: original.length, sha256: createHash('sha256').update(original).digest('hex') });
    expect(fetchMock.mock.lastCall?.[1].headers.Authorization).toBe(`Bearer ${'t'.repeat(64)}`);
    expect(JSON.parse(fetchMock.mock.lastCall?.[1].body)).toEqual({ anio: 2015, mes: 1, ruc: '20146657142' });
    await descargarMes('admin', dato.id, 1); expect(fetchMock).toHaveBeenCalledTimes(3);
    const respuesta = await zipDescarga('admin', dato.id);
    expect(respuesta.headers.get('Content-Disposition')).toContain('1-de-12.zip');
    const zip = extraer(Buffer.from(await respuesta.arrayBuffer()));
    expect(zip.get(completo.meses[0].archivo!)).toEqual(original);
    expect(JSON.parse(zip.get('resumen-descargas.json')!.toString()).meses[1].estado).toBe('pendiente');
    await expect(zipDescarga('otro', dato.id)).rejects.toThrow();
  });
  it('rechaza Excel falso o sobredimensionado sin guardarlo como éxito', async () => {
    expect(() => extensionLibro(Buffer.from('d0cf11e0a1b11ae1', 'hex'))).toThrow();
    const dato = await crearDescarga('admin', 2015);
    fetchMock.mockResolvedValueOnce(new Response('x', { headers: { 'Content-Length': String(26 * 1024 * 1024) } }));
    expect((await descargarMes('admin', dato.id, 1)).meses[0].detalle).toContain('25 MB');
    await expect(zipDescarga('admin', dato.id)).rejects.toThrow(/Todavía/);
  });
  it('no permite dos descargas simultáneas del mismo trabajo', async () => {
    const dato = await crearDescarga('admin', 2015);
    const propietario = createHash('sha256').update('admin').digest('hex');
    await writeFile(path.join(raiz, 'descargas-seace', propietario, dato.id, '.lock'), '');
    await expect(descargarMes('admin', dato.id, 1)).rejects.toThrow(/en curso/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('borra solo staging, y limpia staging caducado al iniciar otro año', async () => {
    const primero = await crearDescarga('admin', 2015);
    await eliminarDescarga('admin', primero.id);
    expect(await ultimaDescarga('admin')).toBeNull();
    const segundo = await crearDescarga('admin', 2016);
    const propietario = createHash('sha256').update('admin').digest('hex');
    const dir = path.join(raiz, 'descargas-seace', propietario, segundo.id);
    await writeFile(path.join(dir, 'resumen.json'), JSON.stringify({ ...segundo, creado: Date.now() - 25 * 3600_000 }));
    const tercero = await crearDescarga('admin', 2017);
    expect(await readdir(path.dirname(dir))).toEqual([tercero.id]);
  });
});
