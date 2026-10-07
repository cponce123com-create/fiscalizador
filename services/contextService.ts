import { z } from 'zod';

// Fuentes: open-meteo.com/en/docs y estadisticas.bcrp.gob.pe/estadisticas/series/ayuda/api.
// Coordenadas de San Ramón, Chanchamayo: geonames.org/3929314/san-ramon.html.
const CLIMA = 'https://api.open-meteo.com/v1/forecast?latitude=-11.12417&longitude=-75.35733&current=temperature_2m,weather_code&timezone=America%2FLima&timeformat=unixtime';
const CAMBIO = 'https://estadisticas.bcrp.gob.pe/estadisticas/series/api/PD04639PD-PD04640PD/json';
export const FUENTE_CLIMA = 'https://open-meteo.com/';
export const FUENTE_CAMBIO = 'https://estadisticas.bcrp.gob.pe/estadisticas/series/diarias/tipo-de-cambio';

export type ContextoLocal = {
  clima: { temperatura: number; condicion: string; fecha: string } | null;
  dolar: { compra: string; venta: string; fecha: string } | null;
};

const esquemaClima = z.object({ current: z.object({
  time: z.number().int().positive(), temperature_2m: z.number().min(-60).max(60), weather_code: z.number().int(),
}) });
const esquemaCambio = z.object({ periods: z.array(z.object({ name: z.string(), values: z.array(z.string()) })) });

function condicion(codigo: number): string {
  if (codigo === 0) return 'Despejado';
  if ([1, 2].includes(codigo)) return 'Parcialmente nublado';
  if (codigo === 3) return 'Nublado';
  if ([45, 48].includes(codigo)) return 'Niebla';
  if ([51, 53, 55, 56, 57].includes(codigo)) return 'Llovizna';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(codigo)) return 'Lluvia';
  if ([71, 73, 75, 77, 85, 86].includes(codigo)) return 'Nieve';
  if ([95, 96, 99].includes(codigo)) return 'Tormenta';
  return 'Condición no especificada';
}

export function interpretarClima(datos: unknown, ahora = Date.now()): ContextoLocal['clima'] {
  const resultado = esquemaClima.safeParse(datos);
  if (!resultado.success) return null;
  const actual = resultado.data.current;
  const instante = actual.time * 1000;
  // No presentar como actual un pronóstico antiguo ni una fecha futura errónea.
  if (ahora - instante > 3 * 60 * 60 * 1000 || instante - ahora > 30 * 60 * 1000) return null;
  return { temperatura: actual.temperature_2m, condicion: condicion(actual.weather_code), fecha: new Date(instante).toISOString() };
}

function fechaBcrp(valor: string): string | null {
  const partes = /^(\d{2})\.([A-Za-z]{3})\.(\d{2}|\d{4})$/.exec(valor);
  if (!partes) return null;
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
  const mesTexto = partes[2].toLowerCase().replace('sep', 'set');
  const mes = meses.indexOf(mesTexto);
  const anio = partes[3].length === 2 ? 2000 + Number(partes[3]) : Number(partes[3]);
  const dia = Number(partes[1]);
  const fecha = new Date(Date.UTC(anio, mes, dia));
  if (mes < 0 || fecha.getUTCMonth() !== mes || fecha.getUTCDate() !== dia) return null;
  return fecha.toISOString().slice(0, 10);
}

export function interpretarCambio(datos: unknown, ahora = Date.now()): ContextoLocal['dolar'] {
  const resultado = esquemaCambio.safeParse(datos);
  if (!resultado.success) return null;
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ahora));
  const validos = resultado.data.periods.flatMap(periodo => {
    const fecha = fechaBcrp(periodo.name);
    const [compra, venta] = periodo.values;
    if (!fecha || fecha > hoy || !compra || !venta || !/^\d+(\.\d+)?$/.test(compra) || !/^\d+(\.\d+)?$/.test(venta)) return [];
    if (!Number.isFinite(Number(compra)) || !Number.isFinite(Number(venta)) || Number(compra) <= 0 || Number(venta) <= 0) return [];
    return [{ fecha, compra: Number(compra).toFixed(3), venta: Number(venta).toFixed(3) }];
  });
  return validos.sort((a, b) => b.fecha.localeCompare(a.fecha))[0] ?? null;
}

async function consultar(url: string): Promise<unknown> {
  const respuesta = await fetch(url, { next: { revalidate: 900 }, signal: AbortSignal.timeout(4500), headers: { Accept: 'application/json' } });
  if (!respuesta.ok) throw new Error('Fuente temporalmente no disponible');
  return respuesta.json();
}

/** Independiente de PostgreSQL y de la carga inicial de la portada. */
export async function contextoLocal(): Promise<ContextoLocal> {
  const [clima, dolar] = await Promise.allSettled([consultar(CLIMA), consultar(CAMBIO)]);
  return {
    clima: clima.status === 'fulfilled' ? interpretarClima(clima.value) : null,
    dolar: dolar.status === 'fulfilled' ? interpretarCambio(dolar.value) : null,
  };
}
