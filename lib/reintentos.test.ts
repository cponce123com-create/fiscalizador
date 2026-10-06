import { describe, expect, it, vi } from 'vitest';

import { reintentar } from '@/lib/reintentos';

/**
 * Pruebas de los reintentos.
 *
 * Lo que importa es que no se reintente de más, que se devuelva el primer resultado
 * correcto y que, si todo falla, se propague el ÚLTIMO error (el útil para saber qué
 * pasó), no el primero.
 */
describe('reintentar', () => {
  it('devuelve el resultado sin reintentar si la primera va bien', async () => {
    const operacion = vi.fn().mockResolvedValue('ok');

    await expect(reintentar(operacion)).resolves.toBe('ok');
    expect(operacion).toHaveBeenCalledTimes(1);
  });

  it('reintenta hasta que la operación funciona', async () => {
    const operacion = vi
      .fn()
      .mockRejectedValueOnce(new Error('primero'))
      .mockRejectedValueOnce(new Error('segundo'))
      .mockResolvedValue('ok');

    await expect(reintentar(operacion, { intentos: 3, esperaMs: 0 })).resolves.toBe('ok');
    expect(operacion).toHaveBeenCalledTimes(3);
  });

  it('relanza el último error cuando se agotan los intentos', async () => {
    const operacion = vi
      .fn()
      .mockRejectedValueOnce(new Error('uno'))
      .mockRejectedValueOnce(new Error('dos'))
      .mockRejectedValue(new Error('tres'));

    await expect(reintentar(operacion, { intentos: 3, esperaMs: 0 })).rejects.toThrow('tres');
    expect(operacion).toHaveBeenCalledTimes(3);
  });

  it('con un solo intento no reintenta', async () => {
    const operacion = vi.fn().mockRejectedValue(new Error('falla'));

    await expect(reintentar(operacion, { intentos: 1 })).rejects.toThrow('falla');
    expect(operacion).toHaveBeenCalledTimes(1);
  });

  it('avisa del fallo antes de cada reintento, con su número de intento', async () => {
    const alFallar = vi.fn();
    const operacion = vi.fn().mockRejectedValue(new Error('falla'));

    await expect(
      reintentar(operacion, { intentos: 3, esperaMs: 0, alFallar }),
    ).rejects.toThrow('falla');

    // Dos avisos, no tres: tras el último intento se relanza, no se avisa.
    expect(alFallar).toHaveBeenCalledTimes(2);
    expect(alFallar).toHaveBeenNthCalledWith(1, expect.any(Error), 1);
    expect(alFallar).toHaveBeenNthCalledWith(2, expect.any(Error), 2);
  });

  it('trata un número de intentos menor que uno como un solo intento', async () => {
    const operacion = vi.fn().mockRejectedValue(new Error('falla'));

    await expect(reintentar(operacion, { intentos: 0 })).rejects.toThrow('falla');
    expect(operacion).toHaveBeenCalledTimes(1);
  });
});
