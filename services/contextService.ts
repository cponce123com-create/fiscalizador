import { z } from 'zod';

// Fuentes: open-meteo.com/en/docs y estadisticas.bcrp.gob.pe/estadisticas/series/ayuda/api.
// Coordenadas de San Ramón, Chanchamayo: geonames.org/3929314/san-ramon.html.
const CLIMA = 'https://api.open-meteo.com/v1/forecast?latitude=-11.12417&longitude=-75.35733&current=temperature_2m,weather_code&timezone=America%2FLima&timeformat=unixtime';
const CAMBIO = 'https://estadisticas.bcrp.gob.pe/estadisticas/series/api/PD04639PD-PD04640PD/json';
const ESPERA_BCRP_MS = 12_000;
const CACHE_CAMBIO_MS = 15 * 60_000;
const REINTENTO_CAMBIO_MS = 30_000;
const RETENCION_CAMBIO_MS = 24 * 60 * 60_000;
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
  // No depender del orden de fecha de un locale: varía entre versiones de ICU.
  const partes = new Intl.DateTimeFormat('en', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ahora));
  const parte = (tipo: string) => partes.find(p => p.type === tipo)?.value;
  const hoy = `${parte('year')}-${parte('month')}-${parte('day')}`;
  const validos = resultado.data.periods.flatMap(periodo => {
    const fecha = fechaBcrp(periodo.name);
    const [compra, venta] = periodo.values.map(valor => valor.trim());
    if (!fecha || fecha > hoy || !compra || !venta || !/^\d+(\.\d+)?$/.test(compra) || !/^\d+(\.\d+)?$/.test(venta)) return [];
    if (!Number.isFinite(Number(compra)) || !Number.isFinite(Number(venta)) || Number(compra) <= 0 || Number(venta) <= 0) return [];
    return [{ fecha, compra: Number(compra).toFixed(3), venta: Number(venta).toFixed(3) }];
  });
  return validos.sort((a, b) => b.fecha.localeCompare(a.fecha))[0] ?? null;
}

/** BCRP puede añadir avisos PHP/HTML después del objeto JSON incluso con HTTP 200. */
export function leerJsonBcrp(texto: string): unknown {
  if (texto.length > 256 * 1024) throw new Error('Respuesta BCRP demasiado extensa');
  const fuente = texto.trim();
  try { return JSON.parse(fuente); } catch { /* Buscar únicamente el fin del objeto inicial. */ }
  if (!fuente.startsWith('{')) throw new Error('Respuesta BCRP no válida');
  let profundidad = 0;
  let cadena = false;
  let escape = false;
  for (let i = 0; i < fuente.length; i++) {
    const caracter = fuente[i];
    if (cadena) {
      if (escape) escape = false;
      else if (caracter === '\\') escape = true;
      else if (caracter === '"') cadena = false;
      continue;
    }
    if (caracter === '"') cadena = true;
    else if (caracter === '{') profundidad++;
    else if (caracter === '}') {
      profundidad--;
      if (profundidad === 0) {
        if (!fuente.slice(i + 1).trimStart().startsWith('<')) break;
        return JSON.parse(fuente.slice(0, i + 1));
      }
    }
  }
  throw new Error('Respuesta BCRP no válida');
}

async function consultar(url: string, esperaMs = 4500, cache = true): Promise<unknown> {
  const respuesta = await fetch(url, { ...(cache ? { next: { revalidate: 900 } } : { cache: 'no-store' as const }), signal: AbortSignal.timeout(esperaMs), headers: { Accept: 'application/json', ...(url === CAMBIO ? { 'User-Agent': 'Fiscalizador/1.0 (+https://fiscalizador.onrender.com)' } : {}) } });
  if (!respuesta.ok) throw new Error('Fuente temporalmente no disponible');
  return url === CAMBIO ? leerJsonBcrp(await respuesta.text()) : respuesta.json();
}

// Solo guarda respuestas interpretadas válidas. No cachear HTML/JSON corrupto como éxito.
let ultimoCambio: { dato: NonNullable<ContextoLocal['dolar']>; consultado: number } | null = null;
let siguienteConsulta = 0;
let consultaPendiente: Promise<ContextoLocal['dolar']> | null = null;
async function consultarCambio(): Promise<ContextoLocal['dolar']> {
  const anterior = () => ultimoCambio && Date.now() - ultimoCambio.consultado < RETENCION_CAMBIO_MS ? ultimoCambio.dato : null;
  if (Date.now() < siguienteConsulta) return anterior();
  if (consultaPendiente) return consultaPendiente;
  consultaPendiente = (async () => {
    try {
      const dato = interpretarCambio(await consultar(CAMBIO, ESPERA_BCRP_MS, false));
      if (!dato) throw new Error('Respuesta sin cotización válida');
      ultimoCambio = { dato, consultado: Date.now() };
      siguienteConsulta = Date.now() + CACHE_CAMBIO_MS;
      return dato;
    } catch (error) {
      siguienteConsulta = Date.now() + REINTENTO_CAMBIO_MS;
      console.warn('[contexto] BCRP no disponible; se conserva el último dato válido si existe.', { tipo: error instanceof Error ? error.name : 'Error' });
      return anterior();
    }
  })();
  try { return await consultaPendiente; } finally { consultaPendiente = null; }
}

/** Independiente de PostgreSQL y de la carga inicial de la portada. */
export async function contextoLocal(): Promise<ContextoLocal> {
  const [clima, dolar] = await Promise.allSettled([consultar(CLIMA), consultarCambio()]);
  return {
    clima: clima.status === 'fulfilled' ? interpretarClima(clima.value) : null,
    dolar: dolar.status === 'fulfilled' ? dolar.value : null,
  };
}
