import { afterEach, describe, expect, it, vi } from 'vitest';
import { peticionPublicaLimitada } from './public-request-limit';
afterEach(() => vi.useRealTimers());
describe('límites públicos compartidos', () => {
  it('bloquea antes de ejecutar y libera plazas después de fallos', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2030-01-01'));
    let liberar!: () => void;
    const pendiente = new Promise<void>(resolve => { liberar = resolve; });
    const ejecutar = async () => { await pendiente; return new Response('ok'); };
    const a = peticionPublicaLimitada('export', ejecutar);
    const b = peticionPublicaLimitada('export', ejecutar);
    const tercero = vi.fn(async () => new Response('no debe ejecutarse'));
    const rechazo = await peticionPublicaLimitada('export', tercero);
    expect(rechazo.status).toBe(429); expect(tercero).not.toHaveBeenCalled();
    expect(rechazo.headers.get('Retry-After')).toBe('60');
    liberar(); await Promise.all([a, b]);
    await expect(peticionPublicaLimitada('export', async () => { throw new Error('fallo'); })).rejects.toThrow('fallo');
    expect((await peticionPublicaLimitada('export', async () => new Response('ok'))).status).toBe(200);
  });
});
