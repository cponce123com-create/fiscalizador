import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
const entorno = vi.hoisted(() => ({ STORAGE_LOCAL_DIR: '' }));
vi.mock('@/lib/env', () => ({ env: entorno }));
import { guardarFotoPrivada, leerFotoPrivada, retirarFotoPrivada, tipoFoto, MAX_FOTO_BYTES } from './privatePhotoStorage';
describe('fotos privadas', () => {
  beforeAll(async () => { entorno.STORAGE_LOCAL_DIR = await mkdtemp(path.join(os.tmpdir(), 'fiscalizador-profile-')); });
  afterAll(async () => { await rm(entorno.STORAGE_LOCAL_DIR, { recursive: true, force: true }); });
  it('rechaza texto disfrazado de imagen y archivos demasiado grandes', () => {
    expect(() => tipoFoto(Buffer.from('<html>foto.jpg</html>'))).toThrow('JPEG');
    expect(() => tipoFoto(Buffer.alloc(MAX_FOTO_BYTES + 1))).toThrow('2 MB');
  });
  it('decodifica, guarda una imagen WebP y la retira sin publicar una ruta', async () => {
    const original = await sharp({ create: { width: 1600, height: 1600, channels: 3, background: '#008080' } }).png().toBuffer();
    const foto = await guardarFotoPrivada(original);
    expect(foto.mime).toBe('image/webp');
    const bytes = await leerFotoPrivada(foto.key);
    const metadata = await sharp(bytes).metadata();
    expect(metadata.width).toBe(1200); expect(metadata.exif).toBeUndefined();
    await expect(leerFotoPrivada('../archivo.png')).rejects.toThrow('inválido');
    await retirarFotoPrivada(foto.key);
    await expect(leerFotoPrivada(foto.key)).rejects.toThrow();
  });
  it('rechaza imágenes corruptas aunque tengan firma JPEG', async () => {
    await expect(guardarFotoPrivada(Buffer.from([255, 216, 255, 0]))).rejects.toThrow('no se pudo leer');
  });
});
