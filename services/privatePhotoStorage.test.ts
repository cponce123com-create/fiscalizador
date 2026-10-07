import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ subir: vi.fn(), leer: vi.fn(), retirar: vi.fn() }));
const entorno = vi.hoisted(() => ({ STORAGE_LOCAL_DIR: '' }));
vi.mock('@/lib/env', () => ({ env: entorno }));
vi.mock('@/services/cloudinaryPhotoService', () => ({ esFotoCloudinary: (key: string) => key.startsWith('cloudinary:'), subirFotoCloudinary: mocks.subir, leerFotoCloudinary: mocks.leer, retirarFotoCloudinary: mocks.retirar }));
import { guardarFotoPrivada, leerFotoPrivada, retirarFotoPrivada, tipoFoto, MAX_FOTO_BYTES } from './privatePhotoStorage';
describe('fotos privadas', () => {
  beforeAll(async () => { entorno.STORAGE_LOCAL_DIR = await mkdtemp(path.join(os.tmpdir(), 'fiscalizador-profile-')); });
  beforeEach(() => vi.resetAllMocks());
  afterAll(async () => { await rm(entorno.STORAGE_LOCAL_DIR, { recursive: true, force: true }); });
  it('rechaza texto disfrazado de imagen y archivos demasiado grandes', () => {
    expect(() => tipoFoto(Buffer.from('<html>foto.jpg</html>'))).toThrow('JPEG');
    expect(() => tipoFoto(Buffer.alloc(MAX_FOTO_BYTES + 1))).toThrow('2 MB');
  });
  it('decodifica, normaliza y sube todas las fotos nuevas a Cloudinary', async () => {
    const original = await sharp({ create: { width: 1600, height: 1600, channels: 3, background: '#008080' } }).png().toBuffer();
    mocks.subir.mockResolvedValue({ key: 'cloudinary:foto', mime: 'image/webp' });
    const foto = await guardarFotoPrivada(original);
    expect(foto.key).toBe('cloudinary:foto');
    const metadata = await sharp(mocks.subir.mock.calls[0][0]).metadata();
    expect(metadata.width).toBe(1200); expect(metadata.exif).toBeUndefined();
    mocks.leer.mockResolvedValue(Buffer.from('foto'));
    expect((await leerFotoPrivada(foto.key)).toString()).toBe('foto');
    await retirarFotoPrivada(foto.key);
    expect(mocks.retirar).toHaveBeenCalledWith('cloudinary:foto');
  });
  it('conserva lectura y retirada de fotos locales anteriores, sin path traversal', async () => {
    const key = '01234567-0123-0123-0123-012345678901.webp';
    await mkdir(path.join(entorno.STORAGE_LOCAL_DIR, 'private-profiles'), { recursive: true });
    await writeFile(path.join(entorno.STORAGE_LOCAL_DIR, 'private-profiles', key), 'anterior');
    expect((await leerFotoPrivada(key)).toString()).toBe('anterior');
    await expect(leerFotoPrivada('../archivo.png')).rejects.toThrow('inválido');
    await retirarFotoPrivada(key);
    await expect(leerFotoPrivada(key)).rejects.toThrow();
    expect(mocks.leer).not.toHaveBeenCalled();
  });
  it('no guarda una foto corrupta ni cambia a disco si Cloudinary falla', async () => {
    await expect(guardarFotoPrivada(Buffer.from([255, 216, 255, 0]))).rejects.toThrow('no se pudo leer');
    expect(mocks.subir).not.toHaveBeenCalled();
    const imagen = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).png().toBuffer();
    mocks.subir.mockRejectedValue(new Error('Cloudinary no disponible'));
    await expect(guardarFotoPrivada(imagen)).rejects.toThrow('Cloudinary');
  });
});
