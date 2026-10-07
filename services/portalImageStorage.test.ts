import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const config = vi.hoisted(() => ({ CLOUDINARY_CLOUD_NAME: 'cloud-test', CLOUDINARY_API_KEY: 'key-test', CLOUDINARY_API_SECRET: 'secret-test' }));
vi.mock('@/lib/env', () => ({ env: config }));
import { prepararImagenPortal, retirarImagenPortal, subirImagenPortal } from './portalImageStorage';

const fetchMock = vi.fn();
async function png() { return sharp({ create: { width: 80, height: 40, channels: 4, background: { r: 0, g: 120, b: 60, alpha: 0.5 } } }).png().toBuffer(); }
describe('imágenes públicas de apariencia', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', fetchMock); config.CLOUDINARY_API_SECRET = 'secret-test'; });
  afterEach(() => vi.unstubAllGlobals());
  it('prepara favicon y social con las dimensiones esperadas; mantiene transparencia', async () => {
    const favicon = await sharp(await prepararImagenPortal(await png(), 'favicon')).metadata();
    expect(favicon).toMatchObject({ format: 'png', width: 256, height: 256, hasAlpha: true });
    expect(await sharp(await prepararImagenPortal(await png(), 'social')).metadata()).toMatchObject({ format: 'png', width: 1200, height: 630 });
    expect(await sharp(await prepararImagenPortal(await png(), 'logo')).metadata()).toMatchObject({ format: 'webp', width: 80, height: 40, hasAlpha: true });
  });
  it('rechaza SVG y archivos que exceden el límite antes de subir', async () => {
    await expect(subirImagenPortal(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'logo')).rejects.toThrow('JPEG');
    await expect(subirImagenPortal(Buffer.alloc(5 * 1024 * 1024 + 1), 'logo')).rejects.toThrow('5 MB');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('firma la subida pública y construye la URL desde la cuenta configurada', async () => {
    fetchMock.mockImplementation(async (_url, init) => Response.json({ public_id: init.body.get('public_id'), type: 'upload', resource_type: 'image', format: 'webp', version: 1700000000, secure_url: 'https://evil.test/imagen' }));
    const foto = await subirImagenPortal(await png(), 'logo');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.cloudinary.com/v1_1/cloud-test/image/upload');
    expect(init.body.get('type')).toBe('upload');
    expect(foto.url).toBe(`https://res.cloudinary.com/cloud-test/image/upload/v1700000000/${foto.publicId}.webp`);
    const campos = ['overwrite', 'public_id', 'timestamp', 'type'].map(k => `${k}=${init.body.get(k)}`).join('&');
    expect(init.body.get('signature')).toBe(createHash('sha256').update(campos + 'secret-test').digest('hex'));
  });
  it('no destruye recursos privados o de otra cuenta', async () => {
    await expect(retirarImagenPortal({ publicId: 'fiscalizador/private-profiles/otro', cloud: 'cloud-test' })).rejects.toThrow('otra configuración');
    await expect(retirarImagenPortal({ publicId: 'fiscalizador/portal/01234567-0123-0123-0123-012345678901', cloud: 'otra-cuenta' })).rejects.toThrow('otra configuración');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('intenta retirar su recurso si la respuesta de subida es inesperada', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ public_id: 'ajeno', type: 'authenticated' })).mockResolvedValueOnce(Response.json({ result: 'ok' }));
    await expect(subirImagenPortal(await png(), 'logo')).rejects.toThrow('no confirmó');
    expect(fetchMock.mock.calls[1][1].body.get('public_id')).toMatch(/^fiscalizador\/portal\//);
    expect(fetchMock.mock.calls[1][1].body.get('invalidate')).toBe('true');
  });
  it('oculta errores y credenciales cuando Cloudinary falla', async () => {
    fetchMock.mockResolvedValue(new Response('secret-test', { status: 401 }));
    await expect(subirImagenPortal(await png(), 'logo')).rejects.toThrow('Revisa la configuración');
  });
});
