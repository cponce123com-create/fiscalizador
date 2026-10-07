import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ permiso: vi.fn(), subir: vi.fn(), retirar: vi.fn(), audit: vi.fn(), upsert: vi.fn(), leer: vi.fn(), lock: vi.fn(), refresh: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ requierePermiso: mocks.permiso, SinPermiso: class extends Error {}, NoAutenticado: class extends Error {} }));
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({ $queryRaw: mocks.lock, appSetting: { findUnique: mocks.leer, upsert: mocks.upsert } }) } }));
vi.mock('@/services/portalImageStorage', () => ({ subirImagenPortal: mocks.subir, retirarImagenPortal: mocks.retirar }));
vi.mock('@/services/auditService', () => ({ registrarAuditoria: mocks.audit }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.refresh }));
import { POST, DELETE } from './route';
import { SinPermiso } from '@/lib/auth/session';
import { ErrorDeNegocio } from '@/lib/errors';
const imagen = { url: 'https://res.cloudinary.com/test/image/upload/logo.webp', publicId: 'fiscalizador/portal/01234567-0123-0123-0123-012345678901', cloud: 'test', credito: '' };
function request(tipo = 'logo', origin = 'https://portal.test', credito = '') {
  const form = new FormData(); form.set('imagen', new File(['imagen'], 'foto.png', { type: 'image/png' })); form.set('credito', credito);
  return new Request(`https://portal.test/api/admin/apariencia/imagenes/${tipo}`, { method: 'POST', headers: { origin }, body: form });
}
const contexto = (tipo = 'logo') => ({ params: Promise.resolve({ tipo }) });
describe('administración de imágenes del portal', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.permiso.mockResolvedValue({ id: 'superadmin' }); mocks.leer.mockResolvedValue(null); mocks.upsert.mockResolvedValue({}); mocks.subir.mockImplementation(async () => ({ ...imagen })); mocks.retirar.mockResolvedValue(undefined); });
  it('rechaza usuarios sin permiso y peticiones de otro origen antes de subir', async () => {
    mocks.permiso.mockRejectedValueOnce(new SinPermiso('Sin permiso'));
    expect((await POST(request(), contexto())).status).toBe(403);
    expect((await POST(request('logo', 'https://otro.test'), contexto())).status).toBe(403);
    expect(mocks.subir).not.toHaveBeenCalled();
    expect(mocks.permiso).toHaveBeenCalledWith('settings:manage');
  });
  it('rechaza tipos desconocidos, foto sin crédito y cuerpos excesivos', async () => {
    expect((await POST(request(), contexto('otro'))).status).toBe(409);
    expect((await POST(request('portada'), contexto('portada'))).status).toBe(409);
    const demasiado = request(); demasiado.headers.set('content-length', String(6 * 1024 * 1024));
    expect((await POST(demasiado, contexto())).status).toBe(409);
    expect(mocks.subir).not.toHaveBeenCalled();
  });
  it('guarda y audita solo su imagen sin tocar la configuración de titulares', async () => {
    const anterior = { ...imagen, publicId: 'fiscalizador/portal/11234567-0123-0123-0123-012345678901' };
    mocks.leer.mockResolvedValue({ value: anterior });
    const response = await POST(request('portada', 'https://portal.test', 'San Ramón · Foto propia'), contexto('portada'));
    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { key: 'portal-imagen-portada' }, update: { value: { ...imagen, credito: 'San Ramón · Foto propia' } } }));
    expect(mocks.lock).toHaveBeenCalledOnce();
    expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: 'superadmin', entityId: 'portal-imagen-portada' }));
    expect(mocks.retirar).toHaveBeenCalledWith(anterior);
    expect(mocks.refresh).toHaveBeenCalledWith('/', 'layout');
  });
  it('retira el recurso nuevo si el guardado falla, conservando la referencia anterior', async () => {
    mocks.upsert.mockRejectedValueOnce(new ErrorDeNegocio('No se pudo guardar'));
    expect((await POST(request(), contexto())).status).toBe(409);
    expect(mocks.retirar).toHaveBeenCalledWith(imagen);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it('informa un fallo de limpieza después de confirmar la nueva imagen', async () => {
    mocks.leer.mockResolvedValue({ value: imagen });
    mocks.retirar.mockRejectedValueOnce(new Error('Cloudinary no disponible'));
    const response = await POST(request(), contexto());
    expect(response.status).toBe(200);
    expect((await response.json()).aviso).toContain('no se pudo retirar');
  });
  it('retirar guarda una anulación explícita para no recuperar una URL antigua', async () => {
    const response = await DELETE(new Request('https://portal.test/api/admin/apariencia/imagenes/portada', { method: 'DELETE', headers: { origin: 'https://portal.test' } }), contexto('portada'));
    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { value: { url: '', publicId: null, cloud: null, credito: '' } } }));
    expect(mocks.subir).not.toHaveBeenCalled();
  });
});
