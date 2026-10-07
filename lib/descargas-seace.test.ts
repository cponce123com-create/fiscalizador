import { describe, expect, it } from 'vitest';
import { enlacesAnualesSeace, RUC_SEACE } from './descargas-seace';

describe('enlaces mensuales oficiales por año y municipalidad', () => {
  it('reproduce el enlace facilitado y genera enero a diciembre sin repetir meses', () => {
    const enlaces = enlacesAnualesSeace(2015);
    expect(enlaces).toHaveLength(12);
    expect(new Set(enlaces.map(m => m.url)).size).toBe(12);
    expect(enlaces[11].url).toBe('https://prod2.seace.gob.pe/seacebus-uiwd-pub/buscadorPublico/ongei/buscadorPublicoOCOS.xhtml?ruc_entidad=20146657142&anio=2015&mes=12&theme=ongei');
    expect(enlaces[0]).toMatchObject({ mes: 1, nombre: 'Enero' });
    for (const enlace of enlaces) {
      const url = new URL(enlace.url);
      expect(url.protocol).toBe('https:');
      expect(url.hostname).toBe('prod2.seace.gob.pe');
      expect(url.searchParams.get('mes')).toBe(String(enlace.mes).padStart(2, '0'));
      expect(url.searchParams.get('anio')).toBe('2015');
      expect(url.searchParams.get('ruc_entidad')).toBe(RUC_SEACE);
    }
  });
  it('actualiza los doce meses al cambiar año o RUC sin perder ceros iniciales', () => {
    for (const enlace of enlacesAnualesSeace(2020, '00123456789')) {
      expect(new URL(enlace.url).searchParams.get('ruc_entidad')).toBe('00123456789');
      expect(new URL(enlace.url).searchParams.get('anio')).toBe('2020');
    }
  });
  it('rechaza RUC incompletos y valores que intenten agregar parámetros', () => {
    for (const ruc of ['', '1234', '20146657142&mes=12', 'abcdefghijk']) expect(() => enlacesAnualesSeace(2020, ruc)).toThrow();
  });
  it('rechaza años fuera de rango o no enteros', () => {
    for (const anio of [1999, 2027, 2020.5, NaN]) expect(() => enlacesAnualesSeace(anio, RUC_SEACE, 2026)).toThrow();
  });
});
