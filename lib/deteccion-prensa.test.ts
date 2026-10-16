import { describe, expect, it } from 'vitest';
import { clasificarContenidoPrensa, pareceContenidoDePrensa } from './deteccion-prensa';

describe('detección de posibles pagos de prensa por descripción', () => {
  it.each([
    'Servicio de spots radiales para la municipalidad',
    'Difusión de comunicados y notas de prensa',
    'Pauta publicitaria en medios de comunicación',
    'Cobertura periodística y producción audiovisual',
    'Perifoneo para comunicar actividades municipales',
  ])('detecta %s', descripcion => expect(pareceContenidoDePrensa(descripcion)).toBe(true));

  it.each([
    'Adquisición de prensa hidráulica para el taller',
    'Compra de radios portátiles para serenazgo',
    'Mantenimiento de maquinaria pesada',
  ])('descarta %s', descripcion => expect(pareceContenidoDePrensa(descripcion)).toBe(false));
});

describe('clasificación explicable de prensa', () => {
  it('separa una posible contratación de prensa de comunicación institucional', () => {
    expect(clasificarContenidoPrensa('Servicio de pauta publicitaria y spot radial').nivel).toBe(2);
    expect(clasificarContenidoPrensa('Producción audiovisual para campaña informativa').nivel).toBe(3);
  });

  it('solo asigna nivel confirmado cuando existe proveedor documentado', () => {
    const descripcion = 'Servicio de cobertura periodística de actividades municipales';
    expect(clasificarContenidoPrensa(descripcion).nivel).toBe(2);
    expect(clasificarContenidoPrensa(descripcion, true).nivel).toBe(1);
  });

  it('explica señales y descarta prensas industriales', () => {
    expect(clasificarContenidoPrensa('Adquisición de prensa hidráulica')).toMatchObject({ nivel: 4, confianza: 0 });
    expect(clasificarContenidoPrensa('Inserción publicitaria en medio digital').senales).toContain('pauta o inserción publicitaria');
  });
});
