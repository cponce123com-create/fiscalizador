import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ config: vi.fn(), permiso: vi.fn(), responder: vi.fn(), listo: vi.fn() }));
vi.mock('@/lib/public-request-limit', () => ({ peticionPublicaLimitada: (_c: string, _r: Request, fn: () => unknown) => fn() }));
vi.mock('@/lib/auth/session', () => ({ requierePermiso: mocks.permiso }));
vi.mock('@/services/ai/settings', () => ({ leerIA: mocks.config, proveedorListo: mocks.listo }));
vi.mock('@/services/ai/assistant', () => ({ responderPregunta: mocks.responder }));
import { POST } from './route';
function request(origin = 'https://fiscalizador.org') {
  const body = new FormData(); body.set('pregunta', 'Contratos de Genaro Poma');
  return new Request('https://fiscalizador.org/api/public/ia', { method: 'POST', headers: { origin }, body });
}
beforeEach(() => { vi.resetAllMocks(); mocks.config.mockResolvedValue({ enabled: true, publicEnabled: true }); mocks.listo.mockReturnValue(true); mocks.responder.mockResolvedValue({ filas: [] }); });
it('impide consultar cuando está desactivado', async () => {
  mocks.config.mockResolvedValue({ enabled: false }); expect((await POST(request())).status).toBe(503); expect(mocks.responder).not.toHaveBeenCalled();
});
it('exige permiso durante pruebas internas', async () => {
  mocks.config.mockResolvedValue({ enabled: true, publicEnabled: false }); mocks.permiso.mockRejectedValue(new Error('unauthorized'));
  expect((await POST(request())).status).toBe(403); expect(mocks.responder).not.toHaveBeenCalled();
});
it('permite prueba administrativa sin activación pública', async () => {
  mocks.config.mockResolvedValue({ enabled: true, publicEnabled: false });
  expect((await POST(request())).status).toBe(200); expect(mocks.responder).toHaveBeenCalledWith('Contratos de Genaro Poma', false);
});
it('rechaza origen externo antes de consumir presupuesto', async () => {
  expect((await POST(request('https://example.com'))).status).toBe(403); expect(mocks.responder).not.toHaveBeenCalled();
});
it('comunica presupuesto agotado sin detalles internos', async () => {
  mocks.responder.mockRejectedValue(new Error('IA_LIMITE'));
  const response = await POST(request()); expect(response.status).toBe(429); expect(response.headers.get('cache-control')).toBe('no-store');
});
