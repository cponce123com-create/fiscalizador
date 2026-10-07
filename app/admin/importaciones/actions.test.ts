import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ permiso: vi.fn(), bulk: vi.fn(), revalidate: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/lib/auth/session', () => ({ requierePermiso: mocks.permiso, SinPermiso: class SinPermiso extends Error {}, NoAutenticado: class NoAutenticado extends Error {} }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/services/importService', () => ({ eliminarImportacion: vi.fn() }));
vi.mock('@/services/bookPublicationService', () => ({ claveOriginal: vi.fn(), leerOriginalVerificado: vi.fn(), tieneColumnasPrivadas: vi.fn() }));
vi.mock('@/services/bulkImportDeletionService', () => ({ eliminarTodasImportaciones: mocks.bulk }));
import { accionEliminarTodasImportaciones } from './actions';
import { SinPermiso } from '@/lib/auth/session';
const estado = { error: null, ok: null };
describe('autorización de borrado masivo', () => {
  beforeEach(() => vi.resetAllMocks());
  it('exige imports:write antes de cualquier borrado', async () => {
    mocks.permiso.mockRejectedValue(new SinPermiso('No autorizado'));
    expect((await accionEliminarTodasImportaciones(estado, new FormData())).error).toBe('No autorizado');
    expect(mocks.permiso).toHaveBeenCalledWith('imports:write'); expect(mocks.bulk).not.toHaveBeenCalled();
  });
  it('envía el inventario confirmado y refresca el portal tras eliminar', async () => {
    mocks.permiso.mockResolvedValue({ id: 'admin' }); mocks.bulk.mockResolvedValue({ lotes: 2, ordenes: 4, archivosPendientes: 1 });
    const form = new FormData(); form.set('huella', 'a'.repeat(64)); form.set('confirmacion', 'ELIMINAR TODAS LAS IMPORTACIONES');
    const result = await accionEliminarTodasImportaciones(estado, form);
    expect(result.ok).toContain('2 importaciones'); expect(result.ok).toContain('1 archivos');
    expect(mocks.bulk).toHaveBeenCalledWith({ userId: 'admin', huella: 'a'.repeat(64), confirmacion: 'ELIMINAR TODAS LAS IMPORTACIONES' });
    expect(mocks.revalidate).toHaveBeenCalledWith('/', 'layout');
  });
});
