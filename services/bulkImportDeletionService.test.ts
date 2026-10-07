import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ batches: vi.fn(), countBatches: vi.fn(), countOrders: vi.fn(), deleteBatches: vi.fn(), deleteSummaries: vi.fn(), deleteSettings: vi.fn(), audit: vi.fn(), lock: vi.fn(), remove: vi.fn(), transaction: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { importBatch: { findMany: mocks.batches, count: mocks.countBatches }, order: { count: mocks.countOrders }, $transaction: mocks.transaction } }));
vi.mock('@/services/storageService', () => ({ getStorage: () => ({ remove: mocks.remove }) }));
import { CONFIRMACION_BORRADO_MASIVO, eliminarTodasImportaciones, huellaImportaciones } from './bulkImportDeletionService';
const lote = { id: 'lote', updatedAt: new Date('2026-01-01'), status: 'COMPLETED', processingStartedAt: new Date(), storageKey: 'original' };
const datos = () => ({ userId: 'admin', confirmacion: CONFIRMACION_BORRADO_MASIVO, huella: huellaImportaciones([lote]) });
describe('borrado masivo de importaciones', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async fn => fn({ $executeRaw: mocks.lock, importBatch: { findMany: mocks.batches, deleteMany: mocks.deleteBatches }, order: { count: mocks.countOrders }, supplierManagementSummary: { deleteMany: mocks.deleteSummaries }, appSetting: { deleteMany: mocks.deleteSettings }, auditLog: { create: mocks.audit } }));
    mocks.batches.mockResolvedValue([lote]); mocks.countOrders.mockResolvedValue(12); mocks.countBatches.mockResolvedValue(0);
  });
  it('exige frase y rechaza inventarios cambiados antes de borrar', async () => {
    await expect(eliminarTodasImportaciones({ ...datos(), confirmacion: '' })).rejects.toThrow('Escribe');
    expect(mocks.transaction).not.toHaveBeenCalled();
    await expect(eliminarTodasImportaciones({ ...datos(), huella: 'otra' })).rejects.toThrow('cambiaron');
    expect(mocks.deleteBatches).not.toHaveBeenCalled();
  });
  it('impide borrar mientras una importación está ejecutándose', async () => {
    mocks.batches.mockResolvedValue([{ ...lote, status: 'PROCESSING' }]);
    await expect(eliminarTodasImportaciones(datos())).rejects.toThrow('Espera');
    expect(mocks.deleteBatches).not.toHaveBeenCalled();
  });
  it.each(['VALIDATING', 'PROCESSING'])('permite retirar un lote pendiente o un proceso caducado (%s)', async status => {
    mocks.batches.mockResolvedValue([{ ...lote, status, processingStartedAt: new Date('2020-01-01') }]);
    expect((await eliminarTodasImportaciones(datos())).lotes).toBe(1);
  });
  it('limpia resúmenes/publicación y audita sin borrar proveedores ni perfiles', async () => {
    const resultado = await eliminarTodasImportaciones(datos());
    expect(resultado).toEqual({ lotes: 1, ordenes: 12, archivosPendientes: 0 });
    expect(mocks.deleteSummaries).toHaveBeenCalledWith({});
    expect(mocks.deleteSettings).toHaveBeenCalledWith({ where: { key: { in: ['libro-original-publico:lote'] } } });
    expect(mocks.deleteBatches).toHaveBeenCalledWith({ where: { id: { in: ['lote'] } } });
    expect(mocks.audit).toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledWith('original');
  });
  it('no retira archivos antes de confirmar la transacción', async () => {
    mocks.audit.mockRejectedValue(new Error('rollback'));
    await expect(eliminarTodasImportaciones(datos())).rejects.toThrow('rollback');
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('informa fallos de limpieza y respeta originales compartidos con nuevos lotes', async () => {
    mocks.remove.mockRejectedValue(new Error('no disponible'));
    expect((await eliminarTodasImportaciones(datos())).archivosPendientes).toBe(1);
    mocks.remove.mockRejectedValue(Object.assign(new Error('ya no existe'), { code: 'ENOENT' }));
    expect((await eliminarTodasImportaciones(datos())).archivosPendientes).toBe(0);
    mocks.remove.mockClear(); mocks.countBatches.mockResolvedValue(1);
    expect((await eliminarTodasImportaciones(datos())).archivosPendientes).toBe(0);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
