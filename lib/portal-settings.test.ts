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
  it('conserva la configuración anterior al añadir fotografía opcional', () => {
    const anterior = { municipio: base.municipio, cintaActiva: base.cintaActiva, titular: base.titular, enlace: base.enlace, velocidad: base.velocidad };
    const actual = esquemaPortal.parse(anterior);
    expect(actual.titular).toBe(base.titular);
    expect(actual.fotoPortada).toBe('');
    expect(actual.creditoFoto).toBe('');
  });
  it('requiere una foto del alojamiento permitido y crédito propio', () => {
    expect(esquemaPortal.safeParse({ ...base, fotoPortada: 'https://res.cloudinary.com/municipio/image/upload/san-ramon.jpg', creditoFoto: 'San Ramón · Foto: propietario' }).success).toBe(true);
    expect(esquemaPortal.safeParse({ ...base, fotoPortada: 'https://res.cloudinary.com/municipio/image/upload/san-ramon.jpg' }).success).toBe(false);
  });
  it.each(['https://otro.test/foto.jpg', 'http://res.cloudinary.com/foto.jpg', 'https://res.cloudinary.com.evil.test/foto.jpg', 'https://user:password@res.cloudinary.com/foto.jpg', 'https://res.cloudinary.com:8443/foto.jpg'])('rechaza fotografía fuera del alojamiento seguro %s', fotoPortada => {
    expect(esquemaPortal.safeParse({ ...base, fotoPortada, creditoFoto: 'Fuente' }).success).toBe(false);
  });
});
