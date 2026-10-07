import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ contexto: vi.fn() }));
vi.mock('@/services/contextService', () => ({ contextoLocal: mocks.contexto }));
import { GET } from './route';
describe('respuesta pública de clima y dólar', () => {
  beforeEach(() => vi.resetAllMocks());
  it('no deja una ausencia temporal del dólar en la caché del navegador o CDN', async () => {
    mocks.contexto.mockResolvedValue({ clima: { temperatura: 25, condicion: 'Nublado', fecha: '2026-10-07T12:00:00Z' }, dolar: null });
    const response = await GET();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await response.json()).dolar).toBeNull();
  });
  it('cachea brevemente los datos válidos y devuelve compra, venta y fecha sin alterarlos', async () => {
    const dato = { clima: null, dolar: { compra: '3.431', venta: '3.437', fecha: '2026-10-06', fuente: 'BCRP' } };
    mocks.contexto.mockResolvedValue(dato);
    const response = await GET();
    expect(response.headers.get('cache-control')).toBe('public, max-age=60, s-maxage=60');
    expect(await response.json()).toEqual(dato);
  });
});
