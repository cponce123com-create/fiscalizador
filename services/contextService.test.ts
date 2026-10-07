import { afterEach, describe, expect, it, vi } from 'vitest';
import { contextoLocal, interpretarCambio, interpretarClima } from './contextService';
const ahora = Date.parse('2026-10-07T12:30:00Z');
const clima = (codigo = 2) => ({ current: { time: ahora / 1000, temperature_2m: 26.4, weather_code: codigo } });
const cambio = { periods: [{ name: '05.Oct.26', values: ['3.720', '3.760'] }, { name: '06.Oct.26', values: ['n.d.', 'n.d.'] }] };
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('clima con fecha y fallos de fuente', () => {
  it('publica la estimación válida y el instante de la fuente', () => {
    expect(interpretarClima(clima(), ahora)).toEqual({ temperatura: 26.4, condicion: 'Parcialmente nublado', fecha: '2026-10-07T12:30:00.000Z' });
  });
  it.each([{}, { current: { temperature_2m: null } }, { current: { ...clima().current, temperature_2m: 100 } }])('no inventa un dato ante respuesta inválida', datos => expect(interpretarClima(datos, ahora)).toBeNull());
  it('descarta clima antiguo y fechas futuras', () => {
    expect(interpretarClima(clima(), ahora + 4 * 3600000)).toBeNull();
    expect(interpretarClima(clima(), ahora - 3600000)).toBeNull();
  });
  it.each([[0, 'Despejado'], [1, 'Parcialmente nublado'], [3, 'Nublado'], [45, 'Niebla'], [51, 'Llovizna'], [61, 'Lluvia'], [71, 'Nieve'], [95, 'Tormenta'], [999, 'Condición no especificada']])('traduce el código WMO %s', (codigo, condicion) => expect(interpretarClima(clima(Number(codigo)), ahora)?.condicion).toBe(condicion));
});

describe('dólar bancario: último dato publicado, no cotización en vivo', () => {
  it('omite días sin datos y conserva tres decimales', () => {
    expect(interpretarCambio(cambio, ahora)).toEqual({ compra: '3.720', venta: '3.760', fecha: '2026-10-05' });
  });
  it('elige la fecha más reciente aunque la fuente llegue desordenada', () => {
    expect(interpretarCambio({ periods: [...cambio.periods, { name: '04.Oct.2026', values: ['3.7', '3.75'] }] }, ahora)?.fecha).toBe('2026-10-05');
  });
  it.each(['31.Feb.26', '04.Xxx.26', '2030-01-01', '08.Oct.26'])('descarta una fecha inválida o futura %s', name => {
    expect(interpretarCambio({ periods: [{ name, values: ['3.7', '3.8'] }] }, ahora)).toBeNull();
  });
  it('entiende Set y Sep con años de dos y cuatro cifras', () => {
    expect(interpretarCambio({ periods: [{ name: '01.Set.26', values: ['3.7', '3.8'] }, { name: '02.Sep.2026', values: ['3.7', '3.8'] }] }, ahora)?.fecha).toBe('2026-09-02');
  });
  it.each([['n.d.', '3.8'], ['0', '3.8'], ['3.7', '0'], ['Infinity', '3.8'], ['', '3.8'], ['3.7'], ['9'.repeat(400), '3.8']])('no completa una cotización ausente %j', (...values) => {
    expect(interpretarCambio({ periods: [{ name: '05.Oct.26', values }] }, ahora)).toBeNull();
  });
  it('no publica una respuesta sin periodos', () => expect(interpretarCambio({}, ahora)).toBeNull());
});

describe('consultas independientes, con caché y espera limitada', () => {
  it('mantiene el clima si el proveedor del dólar falla', async () => {
    vi.useFakeTimers(); vi.setSystemTime(ahora);
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => clima() }).mockRejectedValueOnce(new Error('Fuera de servicio'));
    vi.stubGlobal('fetch', fetchMock);
    expect(await contextoLocal()).toEqual({ clima: interpretarClima(clima(), ahora), dolar: null });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('latitude=-11.12417'), expect.objectContaining({ next: { revalidate: 900 }, signal: expect.any(AbortSignal) }));
  });
  it('mantiene el dólar si el clima devuelve HTTP 503', async () => {
    vi.useFakeTimers(); vi.setSystemTime(ahora);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => cambio }));
    expect(await contextoLocal()).toEqual({ clima: null, dolar: interpretarCambio(cambio, ahora) });
  });
  it('devuelve ambos datos válidos', async () => {
    vi.useFakeTimers(); vi.setSystemTime(ahora);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => clima() }).mockResolvedValueOnce({ ok: true, json: async () => cambio }));
    expect(await contextoLocal()).toEqual({ clima: interpretarClima(clima(), ahora), dolar: interpretarCambio(cambio, ahora) });
  });
  it('devuelve un estado explícito sin datos ante respuestas corruptas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error('JSON inválido'); } }));
    expect(await contextoLocal()).toEqual({ clima: null, dolar: null });
  });
});
