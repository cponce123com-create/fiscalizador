import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const config = vi.hoisted(() => ({ CLOUDINARY_CLOUD_NAME: 'cloud-test', CLOUDINARY_API_KEY: 'key-test', CLOUDINARY_API_SECRET: 'secret-test' }));
vi.mock('@/lib/env', () => ({ env: config }));
import { esFotoCloudinary, leerFotoCloudinary, retirarFotoCloudinary, subirFotoCloudinary } from './cloudinaryPhotoService';
const fetchMock = vi.fn();
const clave = 'cloudinary:v1:cloud-test:01234567-0123-0123-0123-012345678901:asset_test';
describe('fotos protegidas de Cloudinary', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset();
    config.CLOUDINARY_CLOUD_NAME = 'cloud-test'; config.CLOUDINARY_API_KEY = 'key-test'; config.CLOUDINARY_API_SECRET = 'secret-test';
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  it('sube como authenticated, con firma SHA-256 y sin enviar el secret en el formulario', async () => {
    fetchMock.mockImplementation(async (_url, init) => Response.json({ asset_id: 'asset_test', public_id: init.body.get('public_id'), type: 'authenticated', resource_type: 'image', format: 'webp' }));
    const foto = await subirFotoCloudinary(Buffer.from('imagen'));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.cloudinary.com/v1_1/cloud-test/image/upload');
    expect(init.body.get('type')).toBe('authenticated'); expect(init.body.get('overwrite')).toBe('false');
    const publicId = init.body.get('public_id');
    expect(publicId).toMatch(/^fiscalizador\/private-profiles\/[a-f0-9-]{36}$/);
    expect(init.body.get('signature')).toBe(createHash('sha256').update(`overwrite=false&public_id=${publicId}&timestamp=1700000000&type=authenticatedsecret-test`).digest('hex'));
    expect(init.body.has('api_secret')).toBe(false); expect(init.body.get('file').type).toBe('image/webp');
    expect(foto.key).toMatch(/^cloudinary:v1:cloud-test:/); expect(esFotoCloudinary(foto.key)).toBe(true);
  });
  it('descarga por asset_id con firma temporal, sin URL pública y sin caché', async () => {
    fetchMock.mockResolvedValue(new Response('bytes', { headers: { 'Content-Type': 'image/webp' } }));
    expect((await leerFotoCloudinary(clave)).toString()).toBe('bytes');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.cloudinary.com/v1_1/cloud-test/asset/download');
    expect(init.body.get('asset_id')).toBe('asset_test'); expect(init.body.get('expires_at')).toBe('1700000120');
    expect(init.cache).toBe('no-store'); expect(init.method).toBe('POST');
  });
  it('retira la imagen protegida e invalida copias; acepta un recurso ya ausente', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ result: 'ok' })).mockResolvedValueOnce(Response.json({ result: 'not found' }));
    await retirarFotoCloudinary(clave); await retirarFotoCloudinary(clave);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.cloudinary.com/v1_1/cloud-test/image/destroy');
    expect(init.body.get('type')).toBe('authenticated'); expect(init.body.get('invalidate')).toBe('true');
    expect(init.body.get('public_id')).toBe('fiscalizador/private-profiles/01234567-0123-0123-0123-012345678901');
  });
  it('rechaza claves ajenas y credenciales faltantes antes de llamar a Cloudinary', async () => {
    await expect(leerFotoCloudinary('../foto')).rejects.toThrow('inválido');
    await expect(leerFotoCloudinary(clave.replace('cloud-test', 'otra-cuenta'))).rejects.toThrow('otra cuenta');
    config.CLOUDINARY_API_SECRET = '';
    await expect(subirFotoCloudinary(Buffer.from('imagen'))).rejects.toThrow('Configura');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('traduce fallos de Cloudinary sin exponer respuestas ni credenciales', async () => {
    fetchMock.mockResolvedValue(new Response('secret-test detalle interno', { status: 401 }));
    await expect(subirFotoCloudinary(Buffer.from('imagen'))).rejects.toThrow('Revisa las credenciales');
    await expect(leerFotoCloudinary(clave)).rejects.not.toThrow('secret-test');
  });
  it('rechaza respuestas de subida que no confirmen una foto protegida y lecturas no fotográficas', async () => {
    fetchMock.mockImplementationOnce(async (_url, init) => Response.json({ asset_id: 'asset_test', public_id: init.body.get('public_id'), type: 'upload', resource_type: 'image', format: 'webp' })).mockResolvedValueOnce(Response.json({ result: 'ok' }));
    await expect(subirFotoCloudinary(Buffer.from('imagen'))).rejects.toThrow('foto protegida');
    expect(fetchMock.mock.calls[1][0]).toContain('image/destroy');
    expect(fetchMock.mock.calls[1][1].body.get('type')).toBe('upload');
    fetchMock.mockResolvedValue(new Response('<html>', { headers: { 'Content-Type': 'text/html' } }));
    await expect(leerFotoCloudinary(clave)).rejects.toThrow('inesperado');
  });
});
