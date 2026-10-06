import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ permiso: vi.fn(), upsert: vi.fn(), audit: vi.fn(), revalidate: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ requierePermiso: mocks.permiso, NoAutenticado: class extends Error {}, SinPermiso: class extends Error {} }));
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: async (fn: (tx: unknown) => Promise<void>) => fn({ appSetting: { upsert: mocks.upsert } }) } }));
vi.mock('@/services/auditService', () => ({ registrarAuditoria: mocks.audit }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
import { guardarApariencia } from './actions';
function formulario() {
  const f = new FormData();
  for (const [k,v] of Object.entries({ municipio: 'San Ramón', titular: 'Consulta las fuentes', enlace: '/fuentes', velocidad: 'normal', cintaActiva: 'on' })) f.set(k,v);
  return f;
}
describe('publicación administrativa de titulares', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.permiso.mockResolvedValue({ id: 'admin' }); });
  it('deniega la escritura sin permiso de configuración', async () => {
    mocks.permiso.mockRejectedValue(new Error('Sin permiso'));
    const resultado = await guardarApariencia({ error: null, ok: null }, formulario());
    expect(resultado.error).toBeTruthy(); expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.permiso).toHaveBeenCalledWith('settings:manage');
  });
  it('no guarda un enlace peligroso', async () => {
    const form = formulario(); form.set('enlace','javascript:alert(1)');
    expect((await guardarApariencia({ error: null, ok: null },form)).error).toBeTruthy();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it('guarda, registra autoría y actualiza todo el portal', async () => {
    const resultado = await guardarApariencia({ error: null, ok: null }, formulario());
    expect(resultado.ok).toBeTruthy(); expect(mocks.upsert).toHaveBeenCalledOnce();
    expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: 'admin', action: 'CHANGE_SETTINGS' }));
    expect(mocks.revalidate).toHaveBeenCalledWith('/', 'layout');
  });
});
