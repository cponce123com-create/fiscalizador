import { describe, expect, it } from 'vitest';
import { configuracionPorDefecto, esquemaPortal } from './portal-settings';

describe('configuración pública de titulares', () => {
  const base = { ...configuracionPorDefecto(), titular: 'Consulta las fuentes' };
  it.each(['javascript:alert(1)', 'data:text/html,test', '//otro.test', '/\\otro.test', 'https://user:password@otro.test'])('rechaza enlace inseguro %s', enlace => {
    expect(esquemaPortal.safeParse({ ...base, enlace }).success).toBe(false);
  });
  it.each(['/fuentes', 'https://ejemplo.test/documento', ''])('acepta enlace permitido %s', enlace => {
    expect(esquemaPortal.safeParse({ ...base, enlace }).success).toBe(true);
  });
  it('no permite publicar una cinta sin titular ni textos excesivos', () => {
    expect(esquemaPortal.safeParse({ ...base, cintaActiva: true, titular: ' ' }).success).toBe(false);
    expect(esquemaPortal.safeParse({ ...base, titular: 'a'.repeat(281) }).success).toBe(false);
    expect(esquemaPortal.safeParse({ ...base, velocidad: 'otra' }).success).toBe(false);
  });
  it('mantiene la cinta oculta por defecto', () => {
    expect(configuracionPorDefecto().cintaActiva).toBe(false);
  });
});
