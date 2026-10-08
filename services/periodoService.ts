import { computeChecksum, parseSpreadsheet } from '@/services/parseService';
import { indicesPorCampo, mapColumns } from '@/services/mappingService';
import { parseDate, stripDiacritics } from '@/services/normalization';

export function periodoEnNombre(nombre: string): string | null {
  const m = nombre.match(/(?<!\d)(20\d{2})[-_. ]?(0?[1-9]|1[0-2])(?!\d)/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}` : null;
}

export type PeriodoDetectado = {
  periodoSugerido: string | null;
  periodoDelNombre: string | null;
  periodoDelTitulo: string | null;
  fuente: 'titulo' | 'fechas' | null;
  aviso: string | null;
  checksum: string;
  mesesDetectados: { periodo: string; filas: number }[];
  filasLeidas: number;
  coincideConElNombre: boolean | null;
};

/** Lee todas las fechas de emisión, incluso de filas con RUC o monto inválido. */
export async function detectarPeriodo(buffer: Buffer, nombre: string): Promise<PeriodoDetectado> {
  const hoja = parseSpreadsheet(buffer);
  const indices = indicesPorCampo(mapColumns(hoja.headers, hoja.rows));
  const conteo = new Map<string, number>();
  let sinFecha = 0;
  for (const fila of hoja.rows) {
    const fecha = parseDate(indices.issueDate === undefined ? null : fila[indices.issueDate]).value;
    if (!fecha || fecha.getUTCFullYear() < 2000 || fecha.getUTCFullYear() > new Date().getFullYear()) { sinFecha++; continue; }
    const periodo = fecha.toISOString().slice(0, 7);
    conteo.set(periodo, (conteo.get(periodo) ?? 0) + 1);
  }
  const mesesDetectados = [...conteo].map(([periodo, filas]) => ({ periodo, filas }))
    .sort((a, b) => b.filas - a.filas || a.periodo.localeCompare(b.periodo));
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const titulos = new Set<string>();
  for (const fila of hoja.titleRows ?? []) {
    const texto = stripDiacritics(fila.join(' ')).toLowerCase().replace(/setiembre/g, 'septiembre');
    const re = new RegExp(`\\b(${meses.join('|')})\\s*(?:[-/]|de)?\\s*(20\\d{2})\\b`, 'g');
    for (const m of texto.matchAll(re)) titulos.add(`${m[2]}-${String(meses.indexOf(m[1]) + 1).padStart(2, '0')}`);
  }
  const periodoDelTitulo = titulos.size === 1 ? [...titulos][0] : null;
  const periodoDelNombre = periodoEnNombre(nombre);
  // Un título de reporte puede abarcar órdenes de otros meses; se muestran esas fechas.
  let periodoSugerido = periodoDelTitulo ?? (mesesDetectados.length === 1 ? mesesDetectados[0].periodo : null);
  let fuente: PeriodoDetectado['fuente'] = periodoDelTitulo ? 'titulo' : periodoSugerido ? 'fechas' : null;
  let aviso: string | null = null;
  if (titulos.size > 1 || (periodoDelNombre && periodoSugerido && periodoDelNombre !== periodoSugerido)) {
    aviso = 'Las referencias de periodo se contradicen. Revisa el Excel y selecciona el periodo.';
    periodoSugerido = null; fuente = null;
  } else if (!periodoSugerido) {
    aviso = mesesDetectados.length > 1 ? 'Hay fechas de varios meses. No se asigna el mes con más filas: revisa y selecciona el periodo del libro.' : 'No se pudo determinar el periodo. Revisa el Excel y selecciona año y mes.';
  } else if (mesesDetectados.some(m => m.periodo !== periodoSugerido)) {
    aviso = 'El título del reporte y algunas fechas de emisión difieren. Revisa el periodo antes de analizar.';
  } else if (sinFecha) {
    aviso = `${sinFecha} filas sin fecha de emisión legible. Revisa el periodo antes de analizar.`;
  }
  return { periodoSugerido, periodoDelNombre, periodoDelTitulo, fuente, aviso, checksum: computeChecksum(buffer), mesesDetectados, filasLeidas: hoja.rows.length,
    coincideConElNombre: periodoDelNombre && (periodoDelTitulo || mesesDetectados.length === 1) ? periodoDelNombre === (periodoDelTitulo ?? mesesDetectados[0].periodo) : null };
}
