import { afterEach, describe, expect, it, vi } from 'vitest';
const leer = vi.hoisted(() => vi.fn());
vi.mock('@/services/portalService', () => ({ leerConfiguracionPortal: leer }));
afterEach(() => { vi.useRealTimers(); vi.resetModules(); leer.mockReset(); });
describe('metadatos con Neon lento', () => {
  it('responde en 800 ms y comparte la consulta pendiente', async () => {
    vi.useFakeTimers();
    leer.mockImplementation(() => new Promise(() => {}));
    const { configuracionSocialRapida } = await import('./socialSettingsService');
    const a = configuracionSocialRapida();
    const b = configuracionSocialRapida();
    await vi.advanceTimersByTimeAsync(800);
    expect((await a).imagenSocial).toBe('');
    expect((await b).imagenSocial).toBe('');
    expect(leer).toHaveBeenCalledTimes(1);
  });
  it('conserva las imágenes del admin y reutiliza la lectura', async () => {
    const { configuracionPorDefecto } = await import('@/lib/portal-settings');
    const config = { ...configuracionPorDefecto(), favicon: 'https://res.cloudinary.com/demo/favicon.png' };
    leer.mockResolvedValue(config);
    const { configuracionSocialRapida } = await import('./socialSettingsService');
    expect(await configuracionSocialRapida()).toEqual(config);
    expect(await configuracionSocialRapida()).toEqual(config);
    expect(leer).toHaveBeenCalledTimes(1);
  });
});
