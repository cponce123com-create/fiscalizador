import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ permiso: vi.fn(), profile: vi.fn(), read: vi.fn(), save: vi.fn(), remove: vi.fn(), upsert: vi.fn(), refresh: vi.fn(), supplier: vi.fn(), audit: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ requierePermiso: mocks.permiso, SinPermiso: class SinPermiso extends Error {}, NoAutenticado: class NoAutenticado extends Error {} }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.refresh }));
vi.mock('@/services/auditService', () => ({ registrarAuditoria: mocks.audit }));
vi.mock('@/lib/prisma', () => {
  const tx = { supplierProfile: { findUnique: mocks.profile, upsert: mocks.upsert }, supplier: { findUnique: mocks.supplier }, $queryRaw: vi.fn() };
  return { prisma: { ...tx, $transaction: (fn: (db: typeof tx) => unknown) => fn(tx) } };
});
vi.mock('@/services/privatePhotoStorage', () => ({ leerFotoPrivada: mocks.read, guardarFotoPrivada: mocks.save, retirarFotoPrivada: mocks.remove, MAX_FOTO_BYTES: 2 * 1024 * 1024 }));
import { SinPermiso, NoAutenticado } from '@/lib/auth/session';
import { GET, POST, PATCH, DELETE } from './route';
const contexto = () => ({ params: Promise.resolve({ id: 'id' }) });
const url = 'https://ejemplo.test/api/admin/proveedores/id/foto';
describe('privacidad de fotos de perfiles', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.permiso.mockResolvedValue({ id: 'admin' }); });
  function fotoAnterior() {
    return { id: 'perfil', photoKey: 'antigua', isPublic: true, updatedAt: new Date('2026-10-08T00:00:00.000Z'), publication: { foto: { enabled: true, sourceUrl: 'https://ejemplo.test/foto', verifiedAt: '2026-10-08T00:00:00.000Z' } } };
  }
  function preparar() {
    mocks.profile.mockResolvedValue(fotoAnterior()); mocks.supplier.mockResolvedValue({ id: 'id' });
    mocks.save.mockResolvedValue({ key: 'nueva', mime: 'image/webp' });
    mocks.upsert.mockImplementation(async ({ update }) => ({ ...fotoAnterior(), ...update }));
  }
  function request(form: FormData, method = 'POST') { return new Request(url, { method, body: form, headers: { origin: 'https://ejemplo.test' } }); }
  it('conserva la publicación al reemplazar desde un cliente anterior y refresca el portal', async () => {
    preparar(); const form = new FormData(); form.set('foto', new File(['imagen'], 'foto.png'));
    const r = await POST(request(form), contexto());
    expect(r.status).toBe(200); expect((await r.json()).publicada).toBe(true);
    expect(mocks.upsert.mock.calls[0][0].update.publication.foto.enabled).toBe(true);
    expect(mocks.remove).toHaveBeenCalledWith('antigua'); expect(mocks.refresh).toHaveBeenCalledWith('/', 'layout');
  });
  it('publica una foto ya subida sin volver a cargarla y conserva los demás datos', async () => {
    preparar(); mocks.profile.mockResolvedValue({ ...fotoAnterior(), isPublic: false, publication: {} });
    const form = new FormData(); form.set('publicacionExplicita', '1'); form.set('publicar', 'on'); form.set('sourceUrl', 'https://ejemplo.test/foto');
    const r = await PATCH(request(form, 'PATCH'), contexto());
    expect(r.status).toBe(200); expect((await r.json()).publicada).toBe(true);
    expect(mocks.upsert.mock.calls[0][0].update).toMatchObject({ isPublic: true, publication: { foto: { enabled: true, sourceUrl: 'https://ejemplo.test/foto' } } });
    expect(mocks.upsert.mock.calls[0][0].update).not.toHaveProperty('photoKey');
    expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('rechaza una fuente inválida o una edición desfasada y permite retirar la foto', async () => {
    preparar(); const form = new FormData(); form.set('publicacionExplicita', '1'); form.set('publicar', 'on');
    expect((await PATCH(request(form, 'PATCH'), contexto())).status).toBe(409);
    form.set('sourceUrl', 'https://ejemplo.test/foto'); form.set('version', 'antigua');
    expect((await PATCH(request(form, 'PATCH'), contexto())).status).toBe(409);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect((await DELETE(new Request(url, { method: 'DELETE', headers: { origin: 'https://ejemplo.test' } }), contexto())).status).toBe(200);
    expect(mocks.upsert.mock.calls[0][0].update).toMatchObject({ photoKey: null, publication: { foto: { enabled: false } } });
  });
  it('bloquea usuarios sin sesión o permiso antes de consultar la ficha', async () => {
    mocks.permiso.mockRejectedValueOnce(new NoAutenticado());
    expect((await GET(new Request(url), contexto())).status).toBe(401);
    mocks.permiso.mockRejectedValueOnce(new SinPermiso('Sin permiso'));
    expect((await GET(new Request(url), contexto())).status).toBe(403);
    expect(mocks.profile).not.toHaveBeenCalled();
  });
  it('sirve fotos sin caché compartida y exige permiso privado', async () => {
    mocks.profile.mockResolvedValue({ photoKey: 'key', photoMime: 'image/webp' }); mocks.read.mockResolvedValue(Buffer.from('foto'));
    const response = await GET(new Request(url), contexto());
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(mocks.permiso).toHaveBeenCalledWith('persons:read');
  });
  it('acepta el origen público tras el proxy de Render sin depender de la URL interna', async () => {
    const request = new Request('http://internal:10000/api/admin/proveedores/id/foto', { method: 'POST', body: new FormData(), headers: { origin: 'https://fiscalizador.onrender.com', host: 'internal:10000', 'x-forwarded-host': 'fiscalizador.onrender.com' } });
    const response = await POST(request, contexto());
    expect(response.status).toBe(409); // Falta una foto, pero el origen fue aceptado.
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('bloquea modificaciones sin permiso y solicitudes de otro origen', async () => {
    mocks.permiso.mockRejectedValueOnce(new SinPermiso('Sin permiso'));
    expect((await POST(new Request(url, { method: 'POST' }), contexto())).status).toBe(403);
    expect((await POST(new Request(url, { method: 'POST', headers: { origin: 'https://otra.test' } }), contexto())).status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.permiso).toHaveBeenCalledWith('persons:write');
  });
});
