import { describe, expect, it } from 'vitest';
import { pareceContenidoDePrensa } from './deteccion-prensa';

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
