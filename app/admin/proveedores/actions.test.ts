import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ permiso: vi.fn(), guardar: vi.fn(), refresh: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.refresh }));
vi.mock('@/lib/auth/session', () => ({ requierePermiso: mocks.permiso, SinPermiso: class SinPermiso extends Error {}, NoAutenticado: class NoAutenticado extends Error {} }));
vi.mock('@/services/supplierProfileService', () => ({ guardarPerfilProveedor: mocks.guardar }));
import { SinPermiso } from '@/lib/auth/session';
import { accionGuardarPerfilProveedor } from './actions';
const estado = { error: null, ok: null };
describe('edición de perfiles privados', () => {
  beforeEach(() => vi.resetAllMocks());
  it('no deja editar con un permiso de solo lectura', async () => {
    mocks.permiso.mockRejectedValue(new SinPermiso('No autorizado'));
    expect((await accionGuardarPerfilProveedor(estado, new FormData())).error).toBe('No autorizado');
    expect(mocks.permiso).toHaveBeenCalledWith('persons:write'); expect(mocks.guardar).not.toHaveBeenCalled();
  });
  it('guarda la ficha privada, normaliza campos vacíos y refresca el perfil', async () => {
    mocks.permiso.mockResolvedValue({ id: 'admin' });
    const form = new FormData();
    for (const [key, value] of Object.entries({ supplierId: 'proveedor', version: '', birthplace: 'San Ramón', currentAddress: '', notes: '', contacts: '[]' })) form.set(key, value);
    expect((await accionGuardarPerfilProveedor(estado, form)).ok).toBe('Perfil privado guardado.');
    expect(mocks.guardar).toHaveBeenCalledWith({ supplierId: 'proveedor', version: '', birthplace: 'San Ramón', currentAddress: null, notes: null, contacts: [] }, 'admin');
    expect(mocks.refresh).toHaveBeenCalledWith('/admin/proveedores/proveedor');
  });
});
