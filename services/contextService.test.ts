import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { interpretarCambio, interpretarClima, leerJsonBcrp, interpretarSunat } from './contextService';
async function contextoLocal() { return (await import('./contextService')).contextoLocal(); }
const ahora = Date.parse('2026-10-07T12:30:00Z');
const clima = (codigo = 2) => ({ current: { time: ahora / 1000, temperature_2m: 26.4, weather_code: codigo } });
const cambio = { periods: [{ name: '05.Oct.26', values: ['3.720', '3.760'] }, { name: '06.Oct.26', values: ['n.d.', 'n.d.'] }] };
const respuesta = (dato: unknown) => Response.json(dato);
function simularRespaldo(mock: (url: string, options: RequestInit) => unknown) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => url.includes('sunat.gob.pe') ? new Response('', { status: 503 }) : mock(url, options)));
}
beforeEach(() => { vi.resetModules(); vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });

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

describe('SUNAT como fuente principal', () => {
  it.each(['07/10/2026|3.431|3.437|\r\n', '2026-10-07 | 3.431 | 3.437'])('lee la fecha de vigencia y los valores publicados: %s', texto => {
    expect(interpretarSunat(texto, ahora)).toEqual({ fecha: '2026-10-07', compra: '3.431', venta: '3.437', fuente: 'SUNAT' });
  });
  it('escoge la fecha válida más reciente sin depender del orden de filas', () => {
    expect(interpretarSunat('07/10/2026|3.431|3.437|\n06/10/2026|3.42|3.43|\nfecha|compra|venta|', ahora)?.fecha).toBe('2026-10-07');
  });
  it.each(['31/02/2026|3.4|3.5|', '2026-13-01|3.4|3.5|', '08/10/2026|3.4|3.5|', '07/10/2026|0|3.4|', '07/10/2026|3.4|Infinity|', '07/10/2026||3.4|', '07/10/2026|0x10|3.4|', '07/10/2026|3.4e0|3.4|', '<html>No disponible</html>', ''])('rechaza fechas imposibles, futuras o valores no válidos: %s', texto => {
    expect(interpretarSunat(texto, ahora)).toBeNull();
  });
  it('usa el día de Lima al validar una fecha futura', () => {
    expect(interpretarSunat('07/10/2026|3.4|3.5|', Date.parse('2026-10-07T02:00:00Z'))).toBeNull();
  });
  it('consulta SUNAT antes de BCRP y mantiene su fuente al reutilizar la caché', async () => {
    vi.useFakeTimers(); vi.setSystemTime(ahora);
    const fetchMock = vi.fn().mockImplementation(async (url: string) => url.includes('open-meteo') ? respuesta(clima()) : new Response('07/10/2026|3.431|3.437|'));
    vi.stubGlobal('fetch', fetchMock);
    const primero = await contextoLocal();
    expect(primero.dolar).toEqual(interpretarSunat('07/10/2026|3.431|3.437|', ahora));
    expect((await contextoLocal()).dolar?.fuente).toBe('SUNAT');
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('sunat.gob.pe')).length).toBe(1);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('bcrp.gob.pe'))).toBe(false);
  });
  it.each(['http', 'red', 'invalido'])('activa BCRP ante fallo SUNAT de tipo %s y atribuye el respaldo', async fallo => {
    vi.useFakeTimers(); vi.setSystemTime(ahora);
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('open-meteo')) return respuesta(clima());
      if (url.includes('sunat.gob.pe')) {
        if (fallo === 'red') throw new Error('Timeout SUNAT');
        return fallo === 'http' ? new Response('', { status: 503 }) : new Response('<html>Error</html>');
      }
      return respuesta(cambio);
    });
    vi.stubGlobal('fetch', fetchMock);
    expect((await contextoLocal()).dolar).toEqual(interpretarCambio(cambio, ahora));
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.findIndex(url => url.includes('sunat.gob.pe'))).toBeLessThan(urls.findIndex(url => url.includes('bcrp.gob.pe')));
  });
});

describe('dólar bancario: último dato publicado, no cotización en vivo', () => {
  it('recupera el JSON completo cuando BCRP añade avisos HTML, sin incluirlos en los datos', () => {
    const texto = `${JSON.stringify({ ...cambio, config: { title: 'Texto con } y " comillas', extra: { nested: true } } })}<br /><font><b>Warning</b>: aviso del servidor de origen</font>`;
    expect(interpretarCambio(leerJsonBcrp(texto), ahora)).toEqual({ compra: '3.720', venta: '3.760', fecha: '2026-10-05', fuente: 'BCRP' });
  });
  it.each(['<html>Error</html>', '{"periods":[', '{"periods":[]}{"otro":true}', '{"periods":[]}contenido ajeno', '{"periods": [malformado]}<br />Warning'])('rechaza HTML sin JSON, JSON truncado o contenido no válido: %s', texto => {
    expect(() => leerJsonBcrp(texto)).toThrow();
  });
  it('omite días sin datos y conserva tres decimales', () => {
    expect(interpretarCambio(cambio, ahora)).toEqual({ compra: '3.720', venta: '3.760', fecha: '2026-10-05', fuente: 'BCRP' });
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
  it('compara con la fecha de Lima sin depender del orden de formato del locale', () => {
    const format = vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts');
    format.mockReturnValue([{ type: 'month', value: '10' }, { type: 'literal', value: '/' }, { type: 'day', value: '07' }, { type: 'literal', value: '/' }, { type: 'year', value: '2026' }]);
    expect(interpretarCambio(cambio, ahora)?.fecha).toBe('2026-10-05');
  });
  it('omite un dato futuro al cruzar medianoche UTC antes que Lima y limpia espacios', () => {
    const datos = { periods: [{ name: '06.Oct.26', values: [' 3.431 ', '3.437\n'] }, { name: '07.Oct.26', values: ['3.5', '3.6'] }] };
    expect(interpretarCambio(datos, Date.parse('2026-10-07T02:00:00Z'))).toEqual({ compra: '3.431', venta: '3.437', fecha: '2026-10-06', fuente: 'BCRP' });
  });
  it.each([['n.d.', '3.8'], ['0', '3.8'], ['3.7', '0'], ['Infinity', '3.8'], ['', '3.8'], ['3.7'], ['9'.repeat(400), '3.8']])('no completa una cotización ausente %j', (...values) => {
    expect(interpretarCambio({ periods: [{ name: '05.Oct.26', values }] }, ahora)).toBeNull();
  });
  it('no publica una respuesta sin periodos', () => expect(interpretarCambio({}, ahora)).toBeNull());
});

describe('consultas independientes, con caché y espera limitada', () => {
  it('mantiene el clima si el proveedor del dólar falla', async () => {
    vi.useFakeTimers(); vi.setSystemTime(ahora);
    const fetchMock = vi.fn().mockResolvedValueOnce(respuesta(clima())).mockRejectedValueOnce(new Error('Fuera de servicio'));
    simularRespaldo(fetchMock);
    expect(await contextoLocal()).toEqual({ clima: interpretarClima(clima(), ahora), dolar: null });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('latitude=-11.12417'), expect.objectContaining({ next: { revalidate: 900 }, signal: expect.any(AbortSignal) }));
  });
  it('mantiene el dólar si el clima devuelve HTTP 503', async () => {
    vi.useFakeTimers(); vi.setSystemTime(ahora);
    simularRespaldo(vi.fn().mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValueOnce(respuesta(cambio)));
    expect(await contextoLocal()).toEqual({ clima: null, dolar: interpretarCambio(cambio, ahora) });
  });
  it('devuelve ambos datos válidos', async () => {
    vi.useFakeTimers(); vi.setSystemTime(ahora);
    simularRespaldo(vi.fn().mockResolvedValueOnce(respuesta(clima())).mockResolvedValueOnce(respuesta(cambio)));
    expect(await contextoLocal()).toEqual({ clima: interpretarClima(clima(), ahora), dolar: interpretarCambio(cambio, ahora) });
  });
  it('obtiene compra y venta por HTTP cuando el BCRP agrega avisos tras el JSON', async () => {
    vi.useFakeTimers(); vi.setSystemTime(ahora);
    simularRespaldo(vi.fn().mockResolvedValueOnce(respuesta(clima())).mockResolvedValueOnce(new Response(`${JSON.stringify(cambio)}<br /><font>Warning: aviso PHP</font>`, { headers: { 'Content-Type': 'text/html' } })));
    expect((await contextoLocal()).dolar).toEqual(interpretarCambio(cambio, ahora));
  });
  it('devuelve un estado explícito sin datos ante respuestas corruptas', async () => {
    simularRespaldo(vi.fn().mockResolvedValue(new Response('JSON inválido')));
    expect(await contextoLocal()).toEqual({ clima: null, dolar: null });
  });
  it('acepta una respuesta del BCRP que tarda más que los antiguos 4,5 segundos', async () => {
    vi.useFakeTimers(); vi.setSystemTime(ahora);
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
      const control = new AbortController();
      setTimeout(() => control.abort(), ms);
      return control.signal;
    });
    const fetchMock = vi.fn().mockImplementation(async (url: string, options: RequestInit) => {
      if (url.includes('open-meteo')) return respuesta(clima());
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 5500);
        options.signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Timeout')); }, { once: true });
      });
      return respuesta(cambio);
    });
    simularRespaldo(fetchMock);
    const pending = contextoLocal();
    await vi.advanceTimersByTimeAsync(5600);
    expect((await pending).dolar).toEqual(interpretarCambio(cambio, ahora));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('PD04639PD-PD04640PD'), expect.objectContaining({ cache: 'no-store' }));
  });
  it('conserva el último dato con su fecha ante un fallo temporal y permite reintentar', async () => {
    vi.useFakeTimers(); vi.setSystemTime(ahora);
    const fetchMock = vi.fn().mockImplementation(async (url: string) => url.includes('open-meteo') ? respuesta(clima()) : respuesta(cambio));
    simularRespaldo(fetchMock);
    expect((await contextoLocal()).dolar?.fecha).toBe('2026-10-05');
    vi.setSystemTime(ahora + 16 * 60_000);
    fetchMock.mockImplementation(async () => { throw new Error('Fuente no disponible'); });
    expect((await contextoLocal()).dolar).toEqual(interpretarCambio(cambio, ahora));
    const llamadas = fetchMock.mock.calls.length;
    await contextoLocal();
    expect(fetchMock.mock.calls.length).toBe(llamadas + 1); // Solo clima: dólar espera 30 s.
    vi.setSystemTime(ahora + 25 * 60 * 60_000);
    expect((await contextoLocal()).dolar).toBeNull();
  });
  it('comparte la consulta BCRP entre peticiones simultáneas y reutiliza el dato validado', async () => {
    vi.useFakeTimers(); vi.setSystemTime(ahora);
    const fetchMock = vi.fn().mockImplementation(async (url: string) => url.includes('open-meteo') ? respuesta(clima()) : respuesta(cambio));
    simularRespaldo(fetchMock);
    const respuestas = await Promise.all([contextoLocal(), contextoLocal(), contextoLocal()]);
    expect(respuestas.every(r => r.dolar?.compra === '3.720')).toBe(true);
    await contextoLocal();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('PD04639PD')).length).toBe(1);
  });
});
