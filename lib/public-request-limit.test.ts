import { afterEach, describe, expect, it, vi } from 'vitest';
import { peticionPublicaLimitada } from './public-request-limit';
afterEach(() => vi.useRealTimers());
describe('límites públicos compartidos', () => {
  it('bloquea antes de ejecutar y libera plazas después de fallos', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2030-01-01'));
    let liberar!: () => void;
    const pendiente = new Promise<void>(resolve => { liberar = resolve; });
    const ejecutar = async () => { await pendiente; return new Response('ok'); };
    const request = new Request('https://portal.test', { headers: { 'user-agent': 'cliente-a' } });
    const otro = new Request('https://portal.test', { headers: { 'user-agent': 'cliente-c' } });
    const a = peticionPublicaLimitada('export', request, ejecutar);
    const b = peticionPublicaLimitada('export', otro, ejecutar);
    const tercero = vi.fn(async () => new Response('no debe ejecutarse'));
    const rechazo = await peticionPublicaLimitada('export', request, tercero);
    expect(rechazo.status).toBe(429); expect(tercero).not.toHaveBeenCalled();
    expect(rechazo.headers.get('Retry-After')).toBe('60');
    liberar(); await Promise.all([a, b]);
    const recuperado = new Request('https://portal.test', { headers: { 'user-agent': 'cliente-b' } });
    await expect(peticionPublicaLimitada('export', recuperado, async () => { throw new Error('fallo'); })).rejects.toThrow('fallo');
    expect((await peticionPublicaLimitada('export', recuperado, async () => new Response('ok'))).status).toBe(200);
  });
});
