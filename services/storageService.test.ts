import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  construirClave,
  crearAlmacenamientoCloudinary,
  crearAlmacenamientoLocal,
  describirFalloDeAlmacenamiento,
  extensionSegura,
  validarAlmacenamientoConfigurado,
} from '@/services/storageService';

/**
 * Pruebas del almacenamiento de archivos originales.
 *
 * El archivo original es la evidencia de la que sale cada dato del portal, así que
 * aquí se cubre lo que puede salir mal: una extensión que no se admite, un nombre
 * que intente escapar del directorio y un disco en el que no se puede escribir.
 */

const CHECKSUM = 'a'.repeat(64);

describe('construirClave', () => {
  it('deriva la clave del checksum y del nombre', () => {
    expect(construirClave('Lista-OCOS-2023-06.xls', CHECKSUM)).toBe(
      `aa/${'a'.repeat(16)}-lista-ocos-2023-06.xls`,
    );
  });

  it('no deja que un nombre con directorios se escape de la raíz', () => {
    const clave = construirClave('../../etc/passwd.xlsx', CHECKSUM);

    expect(clave.startsWith('aa/')).toBe(true);
    expect(clave).not.toContain('..');
    expect(clave).not.toContain('etc/');
  });

  it('rechaza las extensiones que no se admiten', () => {
    expect(() => construirClave('libro.pdf', CHECKSUM)).toThrow(/Extensión no permitida/);
    expect(() => construirClave('libro', CHECKSUM)).toThrow(/sin extensión/);
  });

  it('admite las tres extensiones permitidas, sin importar las mayúsculas', () => {
    expect(extensionSegura('libro.XLS')).toBe('.xls');
    expect(extensionSegura('libro.xlsx')).toBe('.xlsx');
    expect(extensionSegura('libro.csv')).toBe('.csv');
  });
});

describe('describirFalloDeAlmacenamiento', () => {
  const conCodigo = (code: string) => Object.assign(new Error('fallo del disco'), { code });

  it('traduce los códigos conocidos del sistema de archivos', () => {
    expect(describirFalloDeAlmacenamiento(conCodigo('EACCES'))).toBe(
      'EACCES: permiso denegado en el directorio de almacenamiento',
    );
    expect(describirFalloDeAlmacenamiento(conCodigo('ENOENT'))).toBe(
      'ENOENT: el directorio de almacenamiento no existe',
    );
    expect(describirFalloDeAlmacenamiento(conCodigo('EROFS'))).toContain('solo lectura');
  });

  it('deja el código tal cual si no lo conoce', () => {
    expect(describirFalloDeAlmacenamiento(conCodigo('EWEIRD'))).toBe(
      'fallo de almacenamiento (EWEIRD)',
    );
  });

  it('cae al nombre del error cuando no hay código', () => {
    expect(describirFalloDeAlmacenamiento(new TypeError('x'))).toBe(
      'fallo interno de almacenamiento',
    );
    expect(describirFalloDeAlmacenamiento('texto suelto')).toBe(
      'fallo interno de almacenamiento',
    );
  });
});

describe('driver de disco local', () => {
  let raiz: string;
  let driver: ReturnType<typeof crearAlmacenamientoLocal>;

  beforeAll(async () => {
    raiz = await mkdtemp(path.join(tmpdir(), 'almacenamiento-'));
    driver = crearAlmacenamientoLocal(path.join(raiz, 'uploads'));
  });

  afterAll(async () => {
    await rm(raiz, { recursive: true, force: true });
  });

  it('guarda, lee y borra un archivo, creando los directorios que falten', async () => {
    const contenido = 'contenido del libro';
    const guardado = await driver.save({
      buffer: Buffer.from(contenido),
      filename: 'Lista-OCOS-2023-06.xls',
      checksum: CHECKSUM,
    });

    expect(guardado.key).toBe(`aa/${'a'.repeat(16)}-lista-ocos-2023-06.xls`);
    expect(guardado.bytes).toBe(Buffer.byteLength(contenido));
    expect(await driver.read(guardado.key)).toEqual(Buffer.from(contenido));

    await driver.remove(guardado.key);
    await expect(driver.read(guardado.key)).rejects.toThrow();
  });

  it('no guarda un archivo con una extensión que no está permitida', async () => {
    await expect(
      driver.save({ buffer: Buffer.from('x'), filename: 'libro.pdf', checksum: CHECKSUM }),
    ).rejects.toThrow(/Extensión no permitida/);
  });

  it('falla si la raíz no se puede crear porque es un archivo', async () => {
    const archivo = path.join(raiz, 'no-es-un-directorio');
    await writeFile(archivo, 'x');

    const roto = crearAlmacenamientoLocal(path.join(archivo, 'uploads'));

    await expect(
      roto.save({ buffer: Buffer.from('x'), filename: 'libro.xls', checksum: CHECKSUM }),
    ).rejects.toThrow();
  });

  it('valida que el directorio configurado se pueda escribir al arrancar', async () => {
    process.env.STORAGE_LOCAL_DIR = path.join(raiz, 'arranque');
    await expect(validarAlmacenamientoConfigurado()).resolves.toBeUndefined();
  });
});

describe('driver Cloudinary para originales', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('guarda como RAW autenticado, recupera, verifica y elimina por una clave validada', async () => {
    const contenido = Buffer.from('libro original protegido');
    const checksum = await import('node:crypto').then(({ createHash }) => createHash('sha256').update(contenido).digest('hex'));
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const destino = String(url);
      if (destino.endsWith('/raw/upload')) {
        const publicId = (init?.body as FormData).get('public_id');
        expect((init?.body as FormData).get('type')).toBe('authenticated');
        return Response.json({ asset_id: 'asset_seguro_123', public_id: publicId, resource_type: 'raw', type: 'authenticated', bytes: contenido.byteLength });
      }
      if (destino.endsWith('/asset/download')) return new Response(new Uint8Array(contenido));
      if (destino.endsWith('/raw/destroy')) return Response.json({ result: 'ok' });
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const driver = crearAlmacenamientoCloudinary({ cloud: 'portal', apiKey: 'key', secret: 'secret' });
    const guardado = await driver.save({ buffer: contenido, filename: 'Lista-OCOS.xlsx', checksum });

    expect(guardado.key).toMatch(/^cloudinary-raw:v1:portal:[a-f0-9-]{36}:xlsx:asset_seguro_123$/);
    expect(guardado.url).toMatch(/^cloudinary:\/\/fiscalizador\/originales\//);
    expect(await driver.read(guardado.key)).toEqual(contenido);
    expect(await driver.verify(guardado.key, checksum)).toBe(true);
    await expect(driver.remove(guardado.key)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('rechaza claves manipuladas sin comunicarse con Cloudinary', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const driver = crearAlmacenamientoCloudinary({ cloud: 'portal', apiKey: 'key', secret: 'secret' });

    await expect(driver.read('cloudinary-raw:v1:otro:../../etc:xlsx:id')).rejects.toThrow(/inválido/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
