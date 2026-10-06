import { normalizeKey } from '@/services/normalization';

/**
 * Detección de encabezados y mapeo a campos internos.
 *
 * El pliego insiste en que NO se asuma que los próximos libros tendrán las
 * mismas columnas, ni el mismo orden, ni la misma cantidad (sección 4). Por eso
 * el mapeo se resuelve por catálogo de alias + similitud, y el administrador
 * puede corregirlo antes de confirmar.
 *
 * Los alias principales son los encabezados REALES de
 * `docs/reference/Lista-OCOS-2023-06.xls`.
 */

export type InternalField =
  | 'rowNumber'
  | 'orderType'
  | 'orderNumber'
  | 'contractType'
  | 'description'
  | 'siafNumber'
  | 'issueDate'
  | 'commitmentDate'
  | 'status'
  | 'amount'
  | 'ruc'
  | 'supplierName';

export type ColumnDataTypeValue = 'STRING' | 'INTEGER' | 'DECIMAL' | 'DATE' | 'BOOLEAN';

export type FieldDefinition = {
  field: InternalField;
  label: string;
  dataType: ColumnDataTypeValue;
  /** Sin este campo la fila no puede convertirse en una orden. */
  isRequired: boolean;
  isPublic: boolean;
  description: string;
  aliases: string[];
};

export const CAMPOS_INTERNOS: readonly FieldDefinition[] = [
  {
    field: 'rowNumber',
    label: 'N°',
    dataType: 'INTEGER',
    isRequired: false,
    isPublic: false,
    description: 'Número correlativo de la fila en el libro. No se publica.',
    aliases: ['n', 'nro', 'numero', 'item', 'num'],
  },
  {
    field: 'orderType',
    label: 'Tipo de Orden',
    dataType: 'STRING',
    isRequired: false,
    isPublic: true,
    description: 'Tipo de orden: O/C (compra) u O/S (servicio).',
    aliases: ['tipo orden', 'tipo de orden', 'clase de orden', 'tipo documento'],
  },
  {
    field: 'orderNumber',
    label: 'Número de orden',
    dataType: 'STRING',
    isRequired: true,
    isPublic: true,
    description: 'Número de la orden. Identifica la orden dentro del periodo.',
    aliases: ['numero de orden', 'nro orden', 'nro de orden', 'orden', 'numero orden', 'n orden'],
  },
  {
    field: 'contractType',
    label: 'Tipo de Contratación',
    dataType: 'STRING',
    isRequired: false,
    isPublic: true,
    description: 'Modalidad de contratación declarada en el libro.',
    aliases: ['tipo contratacion', 'tipo de contratacion', 'tipo de contrato', 'modalidad'],
  },
  {
    field: 'description',
    label: 'Descripción y Finalidad de la contratación',
    dataType: 'STRING',
    isRequired: false,
    isPublic: true,
    description: 'Objeto y finalidad de la contratación.',
    aliases: [
      'descripcion y finalidad de la contratacion',
      'descripcion',
      'finalidad',
      'objeto',
      'descripcion de la contratacion',
    ],
  },
  {
    field: 'siafNumber',
    label: 'Nro. Exp. SIAF',
    dataType: 'STRING',
    isRequired: false,
    isPublic: true,
    description:
      'Expediente SIAF. NO es único: en el libro de referencia hay expedientes repetidos, así que no sirve como identificador.',
    aliases: ['nro exp siaf', 'siaf', 'expediente siaf', 'nro siaf', 'exp siaf'],
  },
  {
    field: 'issueDate',
    label: 'Fecha de Emisión',
    dataType: 'DATE',
    isRequired: true,
    isPublic: true,
    description: 'Fecha de emisión de la orden.',
    aliases: ['fecha de emision', 'fecha emision', 'fecha de registro', 'fecha'],
  },
  {
    field: 'commitmentDate',
    label: 'Fecha de Compromiso',
    dataType: 'DATE',
    isRequired: false,
    isPublic: true,
    description: 'Fecha de compromiso. Puede venir vacía en órdenes anuladas.',
    aliases: ['fecha de compromiso', 'fecha compromiso', 'fecha de devengado'],
  },
  {
    field: 'status',
    label: 'Estado',
    dataType: 'STRING',
    isRequired: true,
    isPublic: true,
    description: 'Estado de la orden. Se clasifica contra el catálogo OrderStatus.',
    aliases: ['estado', 'estado de orden', 'situacion', 'estado de la orden'],
  },
  {
    field: 'amount',
    label: 'Monto',
    dataType: 'DECIMAL',
    isRequired: true,
    isPublic: true,
    description: 'Monto registrado de la orden. En el origen viene con prefijo "S/.".',
    aliases: ['monto', 'importe', 'monto total', 'total', 'monto soles', 'valor'],
  },
  {
    field: 'ruc',
    label: 'RUC',
    dataType: 'STRING',
    isRequired: true,
    isPublic: true,
    description: 'RUC del proveedor. Identificador principal del proveedor.',
    aliases: ['ruc', 'ruc proveedor', 'nro ruc', 'ruc del proveedor'],
  },
  {
    field: 'supplierName',
    label: 'Denominación o razón Social',
    dataType: 'STRING',
    isRequired: true,
    isPublic: true,
    description: 'Razón social declarada. Se conserva tal cual y se compara por RUC.',
    aliases: [
      'denominacion o razon social',
      'denominacion',
      'razon social',
      'proveedor',
      'nombre',
      'nombre o razon social',
      'contratista',
    ],
  },
] as const;

export type MatchedBy = 'EXACTO' | 'ALIAS' | 'SIMILITUD' | null;

export type ColumnMapping = {
  position: number;
  originalName: string;
  field: InternalField | null;
  /** 0..1. 1 = coincidencia exacta con el encabezado canónico. */
  confidence: number;
  matchedBy: MatchedBy;
  dataType: ColumnDataTypeValue;
  isRequired: boolean;
  isPublic: boolean;
  sampleValues: string[];
};

// =============================================================================
// Similitud de cadenas
// =============================================================================

/** Distancia de Levenshtein, con dos filas en lugar de matriz completa. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  let actual = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    actual[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      actual[j] = Math.min(
        (anterior[j] ?? 0) + 1,
        (actual[j - 1] ?? 0) + 1,
        (anterior[j - 1] ?? 0) + costo,
      );
    }
    const tmp = anterior;
    anterior = actual;
    actual = tmp;
  }

  return anterior[b.length] ?? 0;
}

/** Similitud normalizada 0..1 basada en Levenshtein. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

/** Similitud por solapamiento de palabras (Jaccard). */
export function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(a.split(' ').filter(Boolean));
  const tb = new Set(b.split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;

  let comunes = 0;
  for (const t of ta) if (tb.has(t)) comunes++;

  const union = ta.size + tb.size - comunes;
  return union === 0 ? 0 : comunes / union;
}

// =============================================================================
// Mapeo
// =============================================================================

const UMBRAL_SIMILITUD = 0.72;

/** Índice de alias normalizados -> campo interno. */
function construirIndice(): Map<string, { field: InternalField; esPrincipal: boolean }> {
  const indice = new Map<string, { field: InternalField; esPrincipal: boolean }>();

  for (const def of CAMPOS_INTERNOS) {
    // El propio `label` es el encabezado canónico observado en el archivo real.
    const claveLabel = normalizeKey(def.label);
    if (claveLabel !== '') indice.set(claveLabel, { field: def.field, esPrincipal: true });

    for (const alias of def.aliases) {
      const clave = normalizeKey(alias);
      if (clave === '' || indice.has(clave)) continue;
      indice.set(clave, { field: def.field, esPrincipal: false });
    }
  }

  return indice;
}

const INDICE_ALIAS = construirIndice();

function definicionDe(field: InternalField): FieldDefinition {
  const def = CAMPOS_INTERNOS.find((c) => c.field === field);
  if (!def) throw new Error(`Campo interno desconocido: ${field}`);
  return def;
}

/**
 * Empareja un encabezado con un campo interno.
 *
 * Orden: coincidencia exacta con el canónico, alias del catálogo y, por último, similitud
 * —pero la similitud **solo se intenta con encabezados de una palabra**.
 *
 * El motivo es un fallo comprobado con encabezados reales de un conjunto de datos abiertos
 * (los de `datosabiertos.gob.pe`, que llevan todo prefijado con «ORDEN_»):
 *
 *   ANNO_ORDEN       -> orderNumber  (0,80)   el AÑO propuesto como número de orden
 *   NRO_MES_ORDEN    -> orderNumber  (0,85)   el MES
 *   ORDEN_PROVEEDOR  -> ruc          (0,73)   la razón social en el campo del RUC
 *
 * Los tres salían con `matchedBy: 'SIMILITUD'` y confianza alta, así que parecían
 * propuestas fiables. La causa es que con varias palabras la distancia de edición mide
 * parecido de LETRAS, no de significado: «anno orden» y «nro orden» se parecen en 8 de cada
 * 10 caracteres y no tienen nada que ver. El solapamiento de palabras, que sí lo detecta,
 * perdía porque el código se quedaba con el máximo de las dos medidas.
 *
 * Y no hay umbral que lo arregle: `NRO_MES_ORDEN` (el mes) y un legítimo «FECHA EMISION
 * ORDEN» tienen exactamente la misma forma —alias más una palabra—, así que cualquier
 * umbral se equivoca con uno de los dos. Ante esa disyuntiva se prefiere **no proponer**:
 * una columna sin mapear la ve el administrador y la asigna en un segundo, mientras que una
 * propuesta incorrecta con 0,85 de confianza se acepta sin mirarla y mete datos falsos en el
 * portal.
 *
 * Con una sola palabra la distancia de edición sí habla de erratas («Montoo», «Estao»), que
 * es justo lo que interesa detectar. Para enseñarle encabezados nuevos está el catálogo de
 * alias, que es el mecanismo previsto.
 */
export function matchHeader(originalName: string): {
  field: InternalField | null;
  confidence: number;
  matchedBy: MatchedBy;
} {
  const clave = normalizeKey(originalName);
  if (clave === '') return { field: null, confidence: 0, matchedBy: null };

  const directo = INDICE_ALIAS.get(clave);
  if (directo) {
    return {
      field: directo.field,
      confidence: directo.esPrincipal ? 1 : 0.95,
      matchedBy: directo.esPrincipal ? 'EXACTO' : 'ALIAS',
    };
  }

  // De aquí en adelante se ADIVINA, y solo se hace con encabezados de una palabra. Ver la
  // nota de arriba: con varias, la distancia de edición propone campos equivocados.
  if (clave.split(' ').length > 1) {
    return { field: null, confidence: 0, matchedBy: null };
  }

  let mejor: { field: InternalField; score: number } | null = null;

  for (const [aliasClave, destino] of INDICE_ALIAS) {
    // Comparar una palabra contra un alias de varias («monto» contra «monto total») no
    // aporta nada: la distancia sale baja por diferencia de longitud, no por parecido.
    if (aliasClave.includes(' ')) continue;

    const score = similarity(clave, aliasClave);
    if (score > (mejor?.score ?? 0)) {
      mejor = { field: destino.field, score };
    }
  }

  if (mejor && mejor.score >= UMBRAL_SIMILITUD) {
    return { field: mejor.field, confidence: Number(mejor.score.toFixed(2)), matchedBy: 'SIMILITUD' };
  }

  return { field: null, confidence: 0, matchedBy: null };
}

/**
 * Mapea todas las columnas de un libro.
 *
 * Un mismo campo interno no puede quedar asignado a dos columnas: si ocurre, se
 * conserva la de mayor confianza y la otra queda sin mapear para que el
 * administrador decida.
 */
export function mapColumns(headers: string[], rows: unknown[][]): ColumnMapping[] {
  const propuestas: ColumnMapping[] = headers.map((originalName, position) => {
    const match = matchHeader(originalName);
    const def = match.field ? definicionDe(match.field) : null;

    return {
      position,
      originalName,
      field: match.field,
      confidence: match.confidence,
      matchedBy: match.matchedBy,
      dataType: def?.dataType ?? 'STRING',
      isRequired: def?.isRequired ?? false,
      isPublic: def?.isPublic ?? true,
      sampleValues: extraerMuestras(rows, position),
    };
  });

  // Resolución de colisiones por campo.
  const porCampo = new Map<InternalField, number>();
  propuestas.forEach((p, idx) => {
    if (!p.field) return;
    const anterior = porCampo.get(p.field);
    if (anterior === undefined) {
      porCampo.set(p.field, idx);
      return;
    }
    const previa = propuestas[anterior] as ColumnMapping;
    if (p.confidence > previa.confidence) {
      propuestas[anterior] = { ...previa, field: null, confidence: 0, matchedBy: null };
      porCampo.set(p.field, idx);
    } else {
      propuestas[idx] = { ...p, field: null, confidence: 0, matchedBy: null };
    }
  });

  return propuestas;
}

function extraerMuestras(rows: unknown[][], position: number, limite = 3): string[] {
  const muestras: string[] = [];
  for (const fila of rows) {
    const valor = fila[position];
    if (valor === null || valor === undefined || valor === '') continue;
    muestras.push(String(valor));
    if (muestras.length >= limite) break;
  }
  return muestras;
}

/** Campos obligatorios que quedaron sin mapear. */
export function camposObligatoriosFaltantes(mappings: ColumnMapping[]): InternalField[] {
  const mapeados = new Set(mappings.map((m) => m.field).filter(Boolean) as InternalField[]);
  return CAMPOS_INTERNOS.filter((c) => c.isRequired && !mapeados.has(c.field)).map((c) => c.field);
}

/** Índice de columna por campo interno, para leer las filas ya mapeadas. */
export function indicesPorCampo(mappings: ColumnMapping[]): Partial<Record<InternalField, number>> {
  const indices: Partial<Record<InternalField, number>> = {};
  for (const m of mappings) {
    if (m.field && indices[m.field] === undefined) indices[m.field] = m.position;
  }
  return indices;
}
