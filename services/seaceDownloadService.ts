import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { ZipArchive } from 'archiver';
import * as XLSX from 'xlsx';

import type { DescargaSeace } from '@/lib/descargas-seace';
import { env } from '@/lib/env';
import { ErrorDeNegocio, NoEncontrado } from '@/lib/errors';

const MAX_BYTES = 25 * 1024 * 1024;
const VIDA_MS = 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function raiz() { return path.resolve(env.STORAGE_LOCAL_DIR, '..', 'descargas-seace'); }
function carpeta(usuario: string, id: string) {
  if (!UUID.test(id)) throw new NoEncontrado('Descarga no encontrada.');
  return path.join(raiz(), createHash('sha256').update(usuario).digest('hex'), id);
}
function configuracion() {
  const token = process.env.SEACE_WORKER_TOKEN;
  let url: URL;
  try { url = new URL(process.env.SEACE_WORKER_URL ?? ''); } catch { throw new ErrorDeNegocio('Configura SEACE_WORKER_URL y SEACE_WORKER_TOKEN en el servidor.'); }
  if (!token || token.length < 32 || url.username || url.password || url.search || url.hash ||
    !(url.protocol === 'https:' || (url.protocol === 'http:' && (url.hostname.endsWith('.internal') || ['localhost', '127.0.0.1'].includes(url.hostname))))) {
    throw new ErrorDeNegocio('La configuración del servicio de descargas SEACE no es válida.');
  }
  return { url: new URL('mes', url.href.endsWith('/') ? url : `${url.href}/`), token };
}
export function seaceConfigurado() { try { configuracion(); return true; } catch { return false; } }
export function validarPeriodo(anio: number, mes = 1) {
  if (!Number.isInteger(anio) || anio < 2000 || anio > new Date().getFullYear() || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new ErrorDeNegocio('Selecciona un año válido y un mes entre 1 y 12.');
  }
}
export function extensionLibro(buffer: Buffer): '.xls' | '.xlsx' {
  const ole = buffer.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'));
  const zip = buffer.subarray(0, 2).toString() === 'PK';
  if (!ole && !zip) throw new ErrorDeNegocio('SEACE no devolvió un Excel válido.');
  try {
    const libro = XLSX.read(buffer, { type: 'buffer', bookSheets: true });
    if (!libro.SheetNames.length) throw new Error();
  } catch { throw new ErrorDeNegocio('El Excel recibido está dañado o no contiene hojas.'); }
  return ole ? '.xls' : '.xlsx';
}
async function guardar(dir: string, dato: DescargaSeace) {
  const temporal = path.join(dir, `${randomUUID()}.tmp`);
  await writeFile(temporal, JSON.stringify(dato));
  await rename(temporal, path.join(dir, 'resumen.json'));
}
export async function obtenerDescarga(usuario: string, id: string): Promise<DescargaSeace> {
  let dato: DescargaSeace;
  try { dato = JSON.parse(await readFile(path.join(carpeta(usuario, id), 'resumen.json'), 'utf8')); }
  catch { throw new NoEncontrado('Descarga no encontrada.'); }
  if (Date.now() - dato.creado > VIDA_MS) throw new ErrorDeNegocio('Esta descarga caducó. Inicia otra descarga anual.');
  return dato;
}
// Exclusión entre procesos; no se mantiene ninguna conexión de base durante la descarga.
async function conBloqueo<T>(dir: string, accion: () => Promise<T>): Promise<T> {
  const archivo = path.join(dir, '.lock');
  await mkdir(dir, { recursive: true });
  // Una petición tarda como máximo 100 s; una cerradura abandonada caduca a los 5 min.
  try { if (Date.now() - (await stat(archivo)).mtimeMs > 300_000) await rm(archivo); } catch { /* No existe. */ }
  let lock;
  try { lock = await open(archivo, 'wx'); } catch { throw new ErrorDeNegocio('Hay una descarga en curso. Espera antes de reintentar.'); }
  try { return await accion(); } finally { await lock.close(); await rm(archivo, { force: true }); }
}
export async function ultimaDescarga(usuario: string) {
  const directorio = path.dirname(carpeta(usuario, randomUUID()));
  let ids: string[];
  try { ids = await readdir(directorio); } catch { return null; }
  for (const id of ids.filter(id => UUID.test(id))) {
    try { return await obtenerDescarga(usuario, id); } catch { /* Caducada. */ }
  }
  return null;
}
export async function crearDescarga(usuario: string, anio: number): Promise<DescargaSeace> {
  validarPeriodo(anio); configuracion();
  return conBloqueo(raiz(), async () => {
    let activos = 0;
    // El staging está separado de los originales importados. Solo se limpia staging caducado.
    for (const propietario of await readdir(raiz(), { withFileTypes: true })) {
      if (!propietario.isDirectory() || !/^[a-f0-9]{64}$/.test(propietario.name)) continue;
      for (const id of await readdir(path.join(raiz(), propietario.name))) {
        if (!UUID.test(id)) continue;
        const dir = path.join(raiz(), propietario.name, id);
        let fecha = (await stat(dir)).mtimeMs;
        try { fecha = (JSON.parse(await readFile(path.join(dir, 'resumen.json'), 'utf8')) as DescargaSeace).creado; } catch { /* Staging incompleto tras un reinicio: limpiar al caducar. */ }
        if (Date.now() - fecha > VIDA_MS) await rm(dir, { recursive: true, force: true });
        else activos++;
      }
    }
    if (activos >= 2) throw new ErrorDeNegocio('Ya hay dos descargas anuales guardadas. Elimina una para liberar espacio.');
    if (await ultimaDescarga(usuario)) throw new ErrorDeNegocio('Ya tienes una descarga guardada. Continúala o elimínala antes de iniciar otra.');
    const ruc = '20146657142';
    const dato: DescargaSeace = { id: randomUUID(), anio, ruc, municipio: 'Municipalidad Distrital de San Ramón', creado: Date.now(), meses: Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, estado: 'pendiente' })) };
    const dir = carpeta(usuario, dato.id);
    await mkdir(dir, { recursive: true }); await guardar(dir, dato);
    return dato;
  });
}
async function leerLimitado(respuesta: Response) {
  if (Number(respuesta.headers.get('content-length')) > MAX_BYTES) {
    await respuesta.body?.cancel();
    throw new ErrorDeNegocio('El libro supera el límite de 25 MB.');
  }
  const reader = respuesta.body?.getReader();
  if (!reader) throw new ErrorDeNegocio('El servicio no devolvió un archivo.');
  const partes: Buffer[] = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) throw new ErrorDeNegocio('El libro supera el límite de 25 MB.');
      partes.push(Buffer.from(value));
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(partes);
}
export async function descargarMes(usuario: string, id: string, mes: number) {
  validarPeriodo(2000, mes);
  const config = configuracion();
  // Obtener antes del lock para no crear carpetas de identificadores inexistentes.
  await obtenerDescarga(usuario, id);
  return conBloqueo(carpeta(usuario, id), async () => {
    const dato = await obtenerDescarga(usuario, id);
    const fila = dato.meses[mes - 1];
    if (fila.estado === 'descargado' && fila.archivo) {
      try {
        const existente = await readFile(path.join(carpeta(usuario, id), path.basename(fila.archivo)));
        if (createHash('sha256').update(existente).digest('hex') === fila.sha256) return dato;
      } catch { /* Volver a descargar un original que ya no está disponible. */ }
    }
    try {
      const respuesta = await fetch(config.url, { method: 'POST', headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ anio: dato.anio, mes, ruc: dato.ruc }), signal: AbortSignal.timeout(100_000), cache: 'no-store', redirect: 'error' });
      if (!respuesta.ok) {
        await respuesta.body?.cancel();
        throw new ErrorDeNegocio(respuesta.status === 422 ? 'SEACE bloqueó la consulta, pidió CAPTCHA o no ofreció un Excel descargable. Revisa el servicio y reintenta.' : respuesta.status === 429 ? 'El servicio está ocupado. Reintenta este mes.' : 'El servicio de navegador no pudo descargar este mes. Revisa su configuración.');
      }
      const buffer = await leerLimitado(respuesta);
      const ext = extensionLibro(buffer);
      const archivo = `Ordenes-y-servicios-${dato.anio}-${String(mes).padStart(2, '0')}-Municipalidad-Distrital-de-San-Ramon${ext}`;
      try { await writeFile(path.join(carpeta(usuario, id), archivo), buffer); }
      catch { throw new ErrorDeNegocio('No se pudo guardar el libro. Revisa el espacio disponible y los permisos del disco del servidor.'); }
      dato.meses[mes - 1] = { mes, estado: 'descargado', archivo, bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') };
    } catch (error) {
      dato.meses[mes - 1] = { mes, estado: 'error', detalle: error instanceof ErrorDeNegocio ? error.message : 'No se pudo conectar o se agotó el tiempo. Reintenta este mes.' };
    }
    await guardar(carpeta(usuario, id), dato);
    return dato;
  });
}
export async function eliminarDescarga(usuario: string, id: string) {
  await obtenerDescarga(usuario, id);
  const dir = carpeta(usuario, id);
  await conBloqueo(dir, async () => {
    for (const nombre of await readdir(dir)) if (nombre !== '.lock') await rm(path.join(dir, nombre), { force: true });
  });
  await rm(dir, { recursive: true, force: true });
}
export async function zipDescarga(usuario: string, id: string) {
  const dato = await obtenerDescarga(usuario, id);
  const libros = dato.meses.filter(m => m.estado === 'descargado' && m.archivo);
  if (!libros.length) throw new ErrorDeNegocio('Todavía no hay libros descargados.');
  const archive = new ZipArchive({ zlib: { level: 1 } });
  // Se abre cada fichero antes de responder, evitando un ZIP incompleto por borrado concurrente.
  const archivos: { handle: Awaited<ReturnType<typeof open>>; nombre: string }[] = [];
  try {
    for (const mes of libros) {
      const archivo = path.join(carpeta(usuario, id), path.basename(mes.archivo!));
      archivos.push({ handle: await open(archivo, 'r'), nombre: mes.archivo! });
    }
  } catch {
    for (const { handle } of archivos) await handle.close();
    throw new ErrorDeNegocio('Un libro guardado ya no está disponible. Elimina la descarga temporal y vuelve a descargar el año.');
  }
  archive.on('error', () => { archive.destroy(); });
  archive.on('warning', error => archive.destroy(error));
  archive.on('close', () => { for (const { handle } of archivos) void handle.close().catch(() => undefined); });
  for (const { handle, nombre } of archivos) archive.append(handle.createReadStream(), { name: nombre });
  archive.append(JSON.stringify(dato, null, 2), { name: 'resumen-descargas.json' });
  void archive.finalize().catch(error => archive.destroy(error));
  return new Response(Readable.toWeb(archive) as ReadableStream<Uint8Array>, { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="Libros-${dato.anio}-San-Ramon-${libros.length}-de-12.zip"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
