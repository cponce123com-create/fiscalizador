import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { env } from '@/lib/env';
import { slugify } from '@/services/normalization';

/**
 * Almacenamiento de los archivos originales que sube el administrador.
 *
 * El archivo original NUNCA se descarta: es la evidencia de la que salió cada
 * dato y lo que permite responder "¿de dónde salió este número?"
 * (docs/prompt.md sección 33, ficha de evidencia).
 *
 * Se define como interfaz de adaptador para poder cambiar de destino sin tocar
 * el importador. En esta entrega solo está implementado el disco local.
 *
 * LIMITACIÓN CONOCIDA: en Render el disco del servicio web es efímero. Para
 * producción hay que usar un destino persistente (Cloudinary, que es la Fase 11
 * del plan, o un volumen montado). El adaptador existe precisamente para que ese
 * cambio no afecte al resto del sistema.
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
  /** Ruta legible del archivo, o null si el driver no expone rutas. */
  localPath(key: string): string | null;
}

const EXTENSIONES_PERMITIDAS = new Set(['.xls', '.xlsx', '.csv']);

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
}

let driver: StorageDriver | null = null;

/** Devuelve el driver configurado por `STORAGE_DRIVER`. */
export function getStorage(): StorageDriver {
  if (driver) return driver;

  if (env.STORAGE_DRIVER === 'cloudinary') {
    throw new Error(
      'STORAGE_DRIVER=cloudinary todavía no está implementado. Es la Fase 11 del plan. ' +
        'Usa STORAGE_DRIVER=local mientras tanto.',
    );
  }

  driver = new LocalStorageDriver(path.resolve(env.STORAGE_LOCAL_DIR));
  return driver;
}

/** Reinicia el driver cacheado. Solo para pruebas. */
export function resetStorage(): void {
  driver = null;
}
