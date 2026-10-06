import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ leer: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { appSetting: { findUnique: mocks.leer } } }));
import { leerConfiguracionPortal } from './portalService';
import { configuracionPorDefecto } from '@/lib/portal-settings';
describe('lectura pública de la configuración', () => {
  beforeEach(() => vi.clearAllMocks());
  it('funciona sin configuración previamente guardada', async () => {
    mocks.leer.mockResolvedValue(null);
    expect(await leerConfiguracionPortal()).toEqual(configuracionPorDefecto());
  });
  it('no publica una configuración antigua o inválida', async () => {
    mocks.leer.mockResolvedValue({value: {cintaActiva: true, enlace: 'javascript:alert(1)'}});
    expect((await leerConfiguracionPortal()).cintaActiva).toBe(false);
  });
  it('devuelve el titular guardado sin datos administrativos', async () => {
    const config = {...configuracionPorDefecto(), cintaActiva: true, titular: 'Consulta las fuentes', enlace:'/fuentes'};
    mocks.leer.mockResolvedValue({value:config,updatedAt:new Date()});
    expect(await leerConfiguracionPortal()).toEqual(config);
  });
});
