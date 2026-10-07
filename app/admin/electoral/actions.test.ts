import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ permiso: vi.fn(), persona: vi.fn(), registro: vi.fn(), borrar: vi.fn(), importar: vi.fn(), refrescar: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ requierePermiso: mocks.permiso }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.refrescar }));
vi.mock('@/lib/api/responses', () => ({ mensajeDeErrorDeAccion: (error: Error) => error.message }));
vi.mock('@/services/electoralService', () => ({ guardarPersonaElectoral: mocks.persona, guardarRegistroElectoral: mocks.registro, eliminarRegistroElectoral: mocks.borrar, importarAntecedentesElectorales: mocks.importar }));
import { accionPersonaElectoral, accionRegistroElectoral, accionEliminarRegistroElectoral, accionImportarElectoral } from './actions';

describe('permisos del registro electoral', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  const estado = { error: null, ok: null };
  it('impide altas, edición y eliminación sin permiso de escritura', async () => {
    mocks.permiso.mockRejectedValue(new Error('Sin permiso'));
    for (const accion of [accionPersonaElectoral, accionRegistroElectoral, accionEliminarRegistroElectoral, accionImportarElectoral]) expect((await accion(estado, new FormData())).error).toBe('Sin permiso');
    expect(mocks.persona).not.toHaveBeenCalled();
    expect(mocks.registro).not.toHaveBeenCalled();
    expect(mocks.borrar).not.toHaveBeenCalled();
    expect(mocks.permiso).toHaveBeenCalledWith('persons:write');
  });
  it('permite guardar una persona sin documento y no la publica por defecto', async () => {
    mocks.permiso.mockResolvedValue({ id: 'admin' });
    const form = new FormData();
    form.set('fullName', 'Persona de prueba'); form.set('dni', '');
    expect((await accionPersonaElectoral(estado, form)).error).toBeNull();
    expect(mocks.persona).toHaveBeenCalledWith({ fullName: 'Persona de prueba', dni: '', isPublic: false, id: undefined }, 'admin');
    expect(mocks.refrescar).toHaveBeenCalledWith('/proveedores', 'layout');
  });
});
