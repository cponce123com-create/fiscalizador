import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

import { env } from '@/lib/env';
import { slugify } from '@/services/normalization';

/**
 * Almacenamiento de los archivos originales que sube el administrador.
 *
 * El archivo original NUNCA se descarta: es la evidencia de la que salió cada
 * dato y lo que permite responder "¿de dónde salió este número?"
 * (docs/prompt.md sección 33, ficha de evidencia).
 *
 * Se define como interfaz de adaptador para cambiar de destino sin tocar el
 * importador. El disco local queda para desarrollo; en Render Free se usa
 * Cloudinary RAW autenticado porque el sistema de archivos es efímero.
 */

export type StoredFile = {
  /** Identificador del archivo dentro del almacenamiento. */
  key: string;
  /** Ruta o URL de acceso. */
  url: string;
  bytes: number;
  /** SHA-256 del contenido. Coincide con `ImportBatch.checksum`. */
  checksum: string;
};

export type SaveInput = {
  buffer: Buffer;
  /** Nombre original, tal como lo subió el administrador. */
  filename: string;
  /** Checksum ya calculado, para no recalcularlo. */
  checksum: string;
};

export interface StorageDriver {
  save(input: SaveInput): Promise<StoredFile>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  verify(key: string, checksum: string): Promise<boolean>;
  /** Ruta legible del archivo, o null si el driver no expone rutas. */
  localPath(key: string): string | null;
}

const EXTENSIONES_PERMITIDAS = new Set(['.xls', '.xlsx', '.csv']);

const MENSAJES_ERRNO: Record<string, string> = {
  EACCES: 'permiso denegado en el directorio de almacenamiento',
  ENOENT: 'el directorio de almacenamiento no existe',
  EPERM: 'operación no permitida',
  EROFS: 'el sistema de archivos es de solo lectura',
  ENOSPC: 'no hay espacio disponible en el disco',
  ENOTDIR: 'la ruta configurada no es un directorio',
  EEXIST: 'ya existe un archivo con esa clave',
};

/**
 * Traduce un fallo del sistema de archivos a algo que se pueda leer y accionar.
 *
 * Existe porque un `STORAGE_LOCAL_DIR` mal puesto en el servidor —por ejemplo,
 * apuntando a un disco que no está montado— hacía que TODA importación devolviera
 * un 500 sin explicación, y la única forma de saber qué pasaba era leer los
 * registros del servidor. El código de error (`EACCES`, `ENOENT`…) dice justo lo
 * que hay que arreglar y no revela rutas.
 */
export function describirFalloDeAlmacenamiento(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'fallo interno de almacenamiento';
  }

  const codigo = (error as NodeJS.ErrnoException).code;

  if (typeof codigo !== 'string' || codigo === '') {
    return 'fallo interno de almacenamiento';
  }

  const descripcion = MENSAJES_ERRNO[codigo];
  if (!descripcion) {
    console.error('Error de almacenamiento no catalogado:', {
      codigo,
      mensaje: error.message,
    });
    return `fallo de almacenamiento (${codigo})`;
  }

  return `${codigo}: ${descripcion}`;
}

/** Extensión en minúsculas, validada contra la lista permitida. */
export function extensionSegura(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (!EXTENSIONES_PERMITIDAS.has(ext)) {
    throw new Error(
      `Extensión no permitida: "${ext || '(sin extensión)'}". Se aceptan .xls, .xlsx y .csv.`,
    );
  }
  return ext;
}

/**
 * Construye la clave del archivo a partir del checksum y un slug del nombre.
 *
 * Se deriva del contenido, no de datos que envía el navegador, así que no puede
 * usarse para escapar del directorio de almacenamiento (path traversal).
 */
export function construirClave(filename: string, checksum: string): string {
  const ext = extensionSegura(filename);
  const base = slugify(path.basename(filename, path.extname(filename))) || 'archivo';
  return path.posix.join(checksum.slice(0, 2), `${checksum.slice(0, 16)}-${base}${ext}`);
}

class LocalStorageDriver implements StorageDriver {
  constructor(private readonly raiz: string) {}

  localPath(key: string): string {
    return path.join(this.raiz, key);
  }

  async save({ buffer, filename, checksum }: SaveInput): Promise<StoredFile> {
    const key = construirClave(filename, checksum);
    const destino = this.localPath(key);

    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, buffer);

    return { key, url: destino, bytes: buffer.byteLength, checksum };
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.localPath(key));
  }

  async remove(key: string): Promise<void> {
    await unlink(this.localPath(key));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.localPath(key), constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  async verify(key: string, checksum: string): Promise<boolean> {
    try {
      return createHash('sha256').update(await this.read(key)).digest('hex') === checksum;
    } catch {
      return false;
    }
  }
}

/** Driver de disco local sobre una raíz concreta. Se exporta para poder probarlo. */
export function crearAlmacenamientoLocal(raiz: string): StorageDriver {
  return new LocalStorageDriver(raiz);
}

type ConfiguracionCloudinary = { cloud: string; apiKey: string; secret: string };
const CARPETA_CLOUDINARY = 'fiscalizador/originales';
const respuestaSubidaCloudinary = z.object({
  asset_id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  public_id: z.string(),
  resource_type: z.literal('raw'),
  type: z.literal('authenticated'),
  bytes: z.number().int().nonnegative(),
});

function configuracionCloudinary(): ConfiguracionCloudinary {
  const cloud = env.CLOUDINARY_CLOUD_NAME?.trim() ?? '';
  const apiKey = env.CLOUDINARY_API_KEY?.trim() ?? '';
  const secret = env.CLOUDINARY_API_SECRET?.trim() ?? '';
  if (!/^[A-Za-z0-9_-]+$/.test(cloud) || !apiKey || !secret) {
    throw new Error('STORAGE_DRIVER=cloudinary requiere CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.');
  }
  return { cloud, apiKey, secret };
}

function firmarCloudinary(params: Record<string, string>, config: ConfiguracionCloudinary) {
  const cadena = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([clave, valor]) => `${clave}=${valor}`)
    .join('&');
  return {
    ...params,
    api_key: config.apiKey,
    signature: createHash('sha256').update(cadena + config.secret).digest('hex'),
  };
}

async function solicitarCloudinary(config: ConfiguracionCloudinary, endpoint: string, body: FormData | URLSearchParams): Promise<Response> {
  try {
    const respuesta = await fetch(`https://api.cloudinary.com/v1_1/${config.cloud}/${endpoint}`, {
      method: 'POST',
      body,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    if (!respuesta.ok) throw new Error(`Cloudinary respondió ${respuesta.status}`);
    return respuesta;
  } catch (error) {
    console.error('Operación de almacenamiento remoto fallida:', error instanceof Error ? error.message : 'error desconocido');
    throw new Error('Cloudinary no pudo completar la operación con el libro original. El lote no continuará sin conservar su evidencia.');
  }
}

function claveCloudinary(cloud: string, uuid: string, extension: string, assetId: string): string {
  return `cloudinary-raw:v1:${cloud}:${uuid}:${extension.slice(1)}:${assetId}`;
}

function leerClaveCloudinary(key: string) {
  const partes = /^cloudinary-raw:v1:([A-Za-z0-9_-]+):([a-f0-9-]{36}):(xls|xlsx|csv):([A-Za-z0-9_-]{1,128})$/.exec(key);
  if (!partes) throw new Error('Identificador de libro remoto inválido.');
  return {
    cloud: partes[1],
    publicId: `${CARPETA_CLOUDINARY}/${partes[2]}.${partes[3]}`,
    assetId: partes[4],
  };
}

class CloudinaryStorageDriver implements StorageDriver {
  constructor(private readonly config: ConfiguracionCloudinary) {}

  localPath(): null { return null; }

  async save({ buffer, filename, checksum }: SaveInput): Promise<StoredFile> {
    const extension = extensionSegura(filename);
    const uuid = randomUUID();
    const publicId = `${CARPETA_CLOUDINARY}/${uuid}${extension}`;
    const params = firmarCloudinary({
      overwrite: 'false',
      public_id: publicId,
      timestamp: String(Math.floor(Date.now() / 1000)),
      type: 'authenticated',
    }, this.config);
    const form = new FormData();
    for (const [clave, valor] of Object.entries(params)) form.set(clave, valor);
    form.set('file', new Blob([new Uint8Array(buffer)], { type: 'application/octet-stream' }), path.basename(filename));

    const respuesta = await solicitarCloudinary(this.config, 'raw/upload', form);
    let json: unknown;
    try { json = await respuesta.json(); } catch { json = null; }
    const subida = respuestaSubidaCloudinary.safeParse(json);
    if (!subida.success || subida.data.public_id !== publicId || subida.data.bytes !== buffer.byteLength) {
      throw new Error('Cloudinary no confirmó íntegramente el libro original. La importación fue detenida.');
    }
    const key = claveCloudinary(this.config.cloud, uuid, extension, subida.data.asset_id);
    return { key, url: `cloudinary://${publicId}`, bytes: subida.data.bytes, checksum };
  }

  async read(key: string): Promise<Buffer> {
    const archivo = leerClaveCloudinary(key);
    if (archivo.cloud !== this.config.cloud) throw new Error('El libro pertenece a otra configuración de Cloudinary.');
    const ahora = Math.floor(Date.now() / 1000);
    const body = new URLSearchParams(firmarCloudinary({
      asset_id: archivo.assetId,
      attachment: 'false',
      expires_at: String(ahora + 120),
      timestamp: String(ahora),
    }, this.config));
    const respuesta = await solicitarCloudinary(this.config, 'asset/download', body);
    const buffer = Buffer.from(await respuesta.arrayBuffer());
    if (!buffer.length) throw new Error('Cloudinary devolvió un libro vacío.');
    return buffer;
  }

  async remove(key: string): Promise<void> {
    const archivo = leerClaveCloudinary(key);
    if (archivo.cloud !== this.config.cloud) throw new Error('El libro pertenece a otra configuración de Cloudinary.');
    const body = new URLSearchParams(firmarCloudinary({
      invalidate: 'true',
      public_id: archivo.publicId,
      timestamp: String(Math.floor(Date.now() / 1000)),
      type: 'authenticated',
    }, this.config));
    const respuesta = await solicitarCloudinary(this.config, 'raw/destroy', body);
    const resultado = z.object({ result: z.enum(['ok', 'not found']) }).safeParse(await respuesta.json());
    if (!resultado.success) throw new Error('Cloudinary no confirmó la eliminación del libro original.');
  }

  async exists(key: string): Promise<boolean> {
    try { await this.read(key); return true; } catch { return false; }
  }

  async verify(key: string, checksum: string): Promise<boolean> {
    try { return createHash('sha256').update(await this.read(key)).digest('hex') === checksum; } catch { return false; }
  }
}

/** Driver remoto protegido para libros originales. Se exporta para pruebas aisladas. */
export function crearAlmacenamientoCloudinary(config: ConfiguracionCloudinary): StorageDriver {
  return new CloudinaryStorageDriver(config);
}

/** Comprueba al arrancar que el driver tenga su configuración mínima disponible. */
export async function validarAlmacenamientoConfigurado(): Promise<void> {
  if (env.STORAGE_DRIVER === 'cloudinary') {
    configuracionCloudinary();
    return;
  }

  const raiz = path.resolve(env.STORAGE_LOCAL_DIR);
  const prueba = path.join(raiz, '.fiscalizador-write-test');

  try {
    await mkdir(raiz, { recursive: true });
    await writeFile(prueba, 'ok');
    await unlink(prueba);
  } catch (error) {
    throw new Error(
      `No se puede escribir en STORAGE_LOCAL_DIR (${describirFalloDeAlmacenamiento(error)}). ` +
        'Configura un directorio persistente y escribible para conservar los libros originales.',
    );
  }

  if (env.NODE_ENV === 'production' && !raiz.startsWith('/var/data/')) {
    console.warn(
      `STORAGE_LOCAL_DIR apunta a ${raiz}. En Render debe estar bajo /var/data para conservar los libros originales entre despliegues.`,
    );
  }
}

export async function existeDirectorioStorage(): Promise<boolean> {
  if (env.STORAGE_DRIVER === 'cloudinary') {
    try { configuracionCloudinary(); return true; } catch { return false; }
  }

  try {
    const raiz = path.resolve(env.STORAGE_LOCAL_DIR);
    await mkdir(raiz, { recursive: true });
    await access(raiz, constants.R_OK | constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

let driver: StorageDriver | null = null;

/** Devuelve el driver configurado por `STORAGE_DRIVER`. */
export function getStorage(): StorageDriver {
  if (driver) return driver;

  if (env.STORAGE_DRIVER === 'cloudinary') {
    driver = crearAlmacenamientoCloudinary(configuracionCloudinary());
    return driver;
  }

  driver = crearAlmacenamientoLocal(path.resolve(env.STORAGE_LOCAL_DIR));
  return driver;
}

/** Reinicia el driver cacheado. Solo para pruebas. */
export function resetStorage(): void {
  driver = null;
}
