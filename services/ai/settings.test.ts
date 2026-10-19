import { beforeEach, describe, expect, it, vi } from 'vitest';
const tx = vi.hoisted(() => ({ $queryRaw: vi.fn(), appSetting: { findUnique: vi.fn(), upsert: vi.fn() } }));
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: (cb: (t: typeof tx) => unknown) => cb(tx) } }));
import { reservarUso, clavesUso, RESERVA_TOKENS } from './settings';
beforeEach(() => vi.clearAllMocks());
describe('presupuesto persistente', () => {
  it('usa el día de Lima, no UTC', () => {
    expect(clavesUso(new Date('2026-11-01T03:00:00Z'))).toEqual(['ia:uso:2026-10', 'ia:uso:2026-10-31']);
  });
  it('reserva ambos contadores tras adquirir el bloqueo', async () => {
    tx.appSetting.findUnique.mockResolvedValueOnce({ value: { enabled: true, publicEnabled: true } }).mockResolvedValue(null);
    await reservarUso(true);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.appSetting.upsert).toHaveBeenCalledTimes(2);
    expect(tx.appSetting.upsert.mock.calls[0][0].create.value.reservado).toBe(RESERVA_TOKENS);
  });
  it('rechaza visitantes mientras está en pruebas', async () => {
    tx.appSetting.findUnique.mockResolvedValue({ value: { enabled: true, publicEnabled: false } });
    await expect(reservarUso(true)).rejects.toThrow('IA_DESACTIVADA');
    expect(tx.appSetting.upsert).not.toHaveBeenCalled();
  });
  it('no llama al proveedor si se agotó el presupuesto mensual', async () => {
    tx.appSetting.findUnique.mockResolvedValueOnce({ value: { enabled: true, publicEnabled: true, monthlyTokens: 12000 } }).mockResolvedValue({ value: { reservado: 12000, llamadas: 1 } });
    await expect(reservarUso(true)).rejects.toThrow('IA_LIMITE');
    expect(tx.appSetting.upsert).not.toHaveBeenCalled();
  });
});
