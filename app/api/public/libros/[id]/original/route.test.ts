import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ libro: vi.fn(), publicado: vi.fn(), privadas: vi.fn(), leer: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { importBatch: { findUnique: mocks.libro } } }));
vi.mock('@/services/portalService', () => ({ leerConfiguracionPortal: async () => ({ municipio: 'San Ramón' }) }));
vi.mock('@/services/bookPublicationService', () => ({ originalPublicado: mocks.publicado, tieneColumnasPrivadas: mocks.privadas, leerOriginalVerificado: mocks.leer }));
vi.mock('@/services/storageService', () => ({ extensionSegura: () => '.xlsx' }));
import { GET } from './route';
const obtener = () => GET(new Request('https://ejemplo.test/api/public/libros/id/original'), { params: Promise.resolve({ id: 'id' }) });
describe('descarga pública del original', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.libro.mockResolvedValue({ id: 'id', status: 'COMPLETED', storageKey: 'key', checksum: 'hash', originalFilename: 'fuente.xlsx', importType: 'ORDENES_COMPRA', month: 1, year: 2026, version: 1 });
    mocks.publicado.mockResolvedValue(true);
    mocks.privadas.mockResolvedValue(false);
    mocks.leer.mockResolvedValue(Buffer.from('bytes originales'));
  });
  it('entrega bytes originales con nombre descriptivo y sin caché', async () => {
    const response = await obtener();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('bytes originales');
    expect(response.headers.get('Content-Disposition')).toContain('Enero 2026');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it('bloquea libros no publicados, fallidos o inexistentes antes de leer disco', async () => {
    mocks.publicado.mockResolvedValue(false);
    expect((await obtener()).status).toBe(404);
    mocks.libro.mockResolvedValue({ status: 'FAILED' });
    expect((await obtener()).status).toBe(404);
    mocks.libro.mockResolvedValue(null);
    expect((await obtener()).status).toBe(404);
    expect(mocks.leer).not.toHaveBeenCalled();
  });
  it('bloquea columnas restringidas aunque se habilitara antes el original', async () => {
    mocks.privadas.mockResolvedValue(true);
    expect((await obtener()).status).toBe(403);
    expect(mocks.leer).not.toHaveBeenCalled();
  });
  it('informa de originales perdidos o alterados sin exponer rutas internas', async () => {
    mocks.leer.mockRejectedValue(new Error('/ruta/interna'));
    const response = await obtener();
    expect(response.status).toBe(410);
    expect(await response.text()).not.toContain('/ruta/interna');
  });
});
