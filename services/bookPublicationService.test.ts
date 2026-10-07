import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ read: vi.fn(), settings: vi.fn(), globales: vi.fn(), columnas: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { appSetting: { findUnique: mocks.settings }, columnVisibility: { findMany: mocks.globales }, importColumn: { findFirst: mocks.columnas } } }));
vi.mock('@/services/storageService', () => ({ getStorage: () => ({ read: mocks.read }) }));
import { leerOriginalVerificado, originalPublicado, tieneColumnasPrivadas } from './bookPublicationService';
describe('publicación de originales', () => {
  beforeEach(() => vi.resetAllMocks());
  it('exige publicación explícita y permite revocarla', async () => {
    mocks.settings.mockResolvedValueOnce(null).mockResolvedValueOnce({ value: { publicado: true } }).mockResolvedValueOnce({ value: { publicado: false } });
    expect(await originalPublicado('id')).toBe(false);
    expect(await originalPublicado('id')).toBe(true);
    expect(await originalPublicado('id')).toBe(false);
  });
  it('aplica las restricciones globales y las propias del libro', async () => {
    mocks.globales.mockResolvedValue([{ internalField: 'supplierRuc' }]);
    mocks.columnas.mockResolvedValue({ id: 'privada' });
    expect(await tieneColumnasPrivadas('id')).toBe(true);
    expect(mocks.columnas).toHaveBeenCalledWith(expect.objectContaining({ where: { importBatchId: 'id', OR: [{ isPublic: false }, { internalField: { in: ['supplierRuc'] } }] } }));
  });
  it('entrega los mismos bytes y rechaza originales alterados o perdidos', async () => {
    const archivo = Buffer.from('original');
    mocks.read.mockResolvedValue(archivo);
    const checksum = createHash('sha256').update(archivo).digest('hex');
    expect(await leerOriginalVerificado('key', checksum)).toBe(archivo);
    await expect(leerOriginalVerificado('key', 'otro')).rejects.toThrow('huella');
    mocks.read.mockRejectedValue(new Error('missing'));
    await expect(leerOriginalVerificado('key', checksum)).rejects.toThrow();
  });
});
