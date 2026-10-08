import { MONTO_ALTO_SOLES, MONTO_ATIPICO_MINIMO_SOLES, FACTOR_MONTO_ATIPICO } from '@/lib/revision-montos';
import {
  buildDedupeKey,
  normalizeKey,
  parseAmount,
  parseDate,
  parseRuc,
  toText,
  type SupplierTypeValue,
} from '@/services/normalization';
import { rowToRawObject, type RawRecord } from '@/services/parseService';
import type { InternalField } from '@/services/mappingService';

/**
 * Validación de las filas de un libro antes de confirmar la importación.
 *
 * Reglas de diseño (docs/prompt.md secciones 14, 30, 31 y 44):
 *   - NADA se corrige en silencio. Si un valor no se entiende, se conserva el
 *     texto original y se emite un hallazgo.
 *   - Un WARNING no bloquea la importación; un ERROR sí impide convertir la
 *     fila en orden.
 *   - `isCancelled` NO se deduce de coincidencia textual sobre el valor crudo:
 *     sale del catálogo `OrderStatus` que administra el propio sistema.
 *
 * Este módulo es PURO: los catálogos se reciben como parámetro, no se leen de
 * la base de datos. Así la validación es testeable sin infraestructura.
 */

export type IssueSeverityValue = 'ERROR' | 'WARNING' | 'INFO';

export type IssueCode =
  | 'ORDEN_NUMERO_VACIO'
  | 'RUC_VACIO'
  | 'RUC_FORMATO'
  | 'RUC_DIGITO_VERIFICADOR'
  | 'PROVEEDOR_NOMBRE_VACIO'
  | 'MONTO_ALTO'
  | 'MONTO_ATIPICO'
  | 'MONTO_COINCIDE_RUC'
  | 'MONTO_VACIO'
  | 'MONTO_FORMATO'
  | 'MONTO_FUERA_DE_RANGO'
  | 'FECHA_EMISION_VACIA'
  | 'FECHA_EMISION_FORMATO'
  | 'FECHA_COMPROMISO_FORMATO'
  | 'FECHA_AMBIGUA'
  | 'FECHA_FUERA_DE_RANGO'
  | 'ESTADO_DESCONOCIDO'
  | 'SIN_GESTION'
  | 'DUPLICADO_EN_LOTE';

export type ValidationIssue = {
  severity: IssueSeverityValue;
  code: IssueCode;
  message: string;
  /** Número de fila tal como se ve en el archivo (el encabezado es la 1). */
  sourceRow: number;
  columnName?: string;
  rawValue?: string;
};

export type CatalogEntry = {
  id: string;
  code: string;
  label: string;
  aliases: string[];
};

export type StatusCatalogEntry = CatalogEntry & {
  countsEconomically: boolean;
  isCancelled: boolean;
  isUnknown: boolean;
};

export type ManagementPeriodEntry = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
};

export type ValidateInput = {
  headers: string[];
  rows: unknown[][];
  sourceRows?: number[];
  indices: Partial<Record<InternalField, number>>;
  /** Índice de la fila de encabezado, para reportar el número de fila real. */
  headerRowIndex: number;
  statuses: StatusCatalogEntry[];
  orderTypes: CatalogEntry[];
  contractTypes: CatalogEntry[];
  managementPeriods: ManagementPeriodEntry[];
};

export type ValidatedOrder = {
  sourceRow: number;
  rowNumber: number | null;
  orderNumber: string;
  orderTypeId: string | null;
  orderTypeRaw: string | null;
  contractTypeId: string | null;
  contractTypeRaw: string | null;
  description: string | null;
  siafNumber: string | null;
  issueDate: Date | null;
  commitmentDate: Date | null;
  statusId: string | null;
  statusRaw: string | null;
  isCancelled: boolean;
  countsEconomically: boolean;
  amount: string | null;
  rawAmount: string | null;
  ruc: string | null;
  supplierName: string | null;
  supplierType: SupplierTypeValue;
  managementPeriodId: string | null;
  rawData: RawRecord;
  dedupeKey: string | null;
  issues: ValidationIssue[];
  hasError: boolean;
  hasWarning: boolean;
};

export type ValidationSummary = {
  totalRows: number;
  successfulRows: number;
  warningRows: number;
  errorRows: number;
  cancelledRows: number;
  /** Sumas en centavos para no arrastrar error de coma flotante. */
  registeredCents: number;
  cancelledCents: number;
  consideredCents: number;
};

export type ValidationResult = {
  orders: ValidatedOrder[];
  issues: ValidationIssue[];
  summary: ValidationSummary;
};

/** Convierte "14769.50" a 1476950 centavos. */
export function decimalACentavos(valor: string): number {
  const [entero = '0', decimales = '00'] = valor.split('.');
  return Number(entero) * 100 + Number(decimales.padEnd(2, '0').slice(0, 2));
}

function construirIndiceCatalogo(
  entradas: readonly CatalogEntry[],
): Map<string, CatalogEntry> {
  const indice = new Map<string, CatalogEntry>();
  for (const entrada of entradas) {
    for (const clave of [entrada.code, entrada.label, ...entrada.aliases]) {
      const k = normalizeKey(clave);
      if (k !== '' && !indice.has(k)) indice.set(k, entrada);
    }
  }
  return indice;
}

function buscarGestion(
  fecha: Date | null,
  gestiones: readonly ManagementPeriodEntry[],
): string | null {
  if (!fecha) return null;
  const t = fecha.getTime();
  for (const g of gestiones) {
    if (t >= g.startDate.getTime() && t <= g.endDate.getTime()) return g.id;
  }
  return null;
}

function valor(fila: unknown[], indice: number | undefined): unknown {
  if (indice === undefined) return null;
  return fila[indice] ?? null;
}

/**
 * Valida todas las filas y devuelve las órdenes listas para insertar más el
 * detalle de hallazgos.
 *
 * Las filas con ERROR no se incluyen en `orders`: no se puede construir una
 * orden sin número, sin RUC o sin proveedor identificable.
 */
export function validateRows(input: ValidateInput): ValidationResult {
  const {
    headers,
    rows,
    indices,
    headerRowIndex,
    sourceRows,
    statuses,
    orderTypes,
    contractTypes,
    managementPeriods,
  } = input;

  const indiceEstados = construirIndiceCatalogo(statuses);
  const indiceTiposOrden = construirIndiceCatalogo(orderTypes);
  const indiceTiposContrato = construirIndiceCatalogo(contractTypes);

  const estadoDesconocido = statuses.find((s) => s.isUnknown) ?? null;

  const orders: ValidatedOrder[] = [];
  const issues: ValidationIssue[] = [];
  const vistos = new Map<string, number>();

  let errorRows = 0;
  let warningRows = 0;
  let cancelledRows = 0;
  let registeredCents = 0;
  let cancelledCents = 0;

  rows.forEach((fila, idx) => {
    const sourceRow = sourceRows?.[idx] ?? headerRowIndex + 2 + idx;
    const propios: ValidationIssue[] = [];

    const agregar = (
      severity: IssueSeverityValue,
      code: IssueCode,
      message: string,
      columnName?: string,
      rawValue?: string,
    ) => {
      propios.push({ severity, code, message, sourceRow, columnName, rawValue });
    };

    // --- Número de orden -----------------------------------------------------
    const orderNumber = toText(valor(fila, indices.orderNumber)).trim();
    if (orderNumber === '') {
      agregar(
        'ERROR',
        'ORDEN_NUMERO_VACIO',
        'La fila no tiene número de orden; no puede identificarse.',
        'Número de orden',
      );
    }

    // --- RUC -----------------------------------------------------------------
    const rucParsed = parseRuc(valor(fila, indices.ruc));
    if (rucParsed.problem === 'VACIO') {
      agregar('ERROR', 'RUC_VACIO', 'La fila no tiene RUC.', 'RUC');
    } else if (rucParsed.problem === 'FORMATO') {
      agregar(
        'ERROR',
        'RUC_FORMATO',
        `El RUC "${rucParsed.raw}" no tiene 11 dígitos.`,
        'RUC',
        rucParsed.raw,
      );
    } else if (!rucParsed.checkDigitValid) {
      agregar(
        'WARNING',
        'RUC_DIGITO_VERIFICADOR',
        `El RUC ${rucParsed.value} no supera la validación del dígito verificador. Se conserva tal cual.`,
        'RUC',
        rucParsed.raw,
      );
    }

    // --- Proveedor -----------------------------------------------------------
    const supplierName = toText(valor(fila, indices.supplierName)).trim();
    if (supplierName === '') {
      agregar(
        'WARNING',
        'PROVEEDOR_NOMBRE_VACIO',
        'La fila no tiene denominación o razón social.',
        'Denominación o razón Social',
      );
    }

    // --- Monto ---------------------------------------------------------------
    const monto = parseAmount(valor(fila, indices.amount));
    if (monto.problem === 'VACIO') {
      agregar('WARNING', 'MONTO_VACIO', 'La fila no tiene monto.', 'Monto');
    } else if (monto.problem === 'FORMATO') {
      agregar(
        'WARNING',
        'MONTO_FORMATO',
        `No se pudo interpretar el monto "${monto.raw}".`,
        'Monto',
        monto.raw,
      );
    } else if (monto.problem === 'FUERA_DE_RANGO') {
      agregar(
        'WARNING',
        'MONTO_FUERA_DE_RANGO',
        `El monto "${monto.raw}" excede el máximo representable.`,
        'Monto',
        monto.raw,
      );
    }

    // --- Fechas --------------------------------------------------------------
    const emision = parseDate(valor(fila, indices.issueDate));
    if (emision.problem === 'VACIO') {
      agregar('WARNING', 'FECHA_EMISION_VACIA', 'La fila no tiene fecha de emisión.', 'Fecha de Emisión');
    } else if (emision.problem === 'FORMATO') {
      agregar(
        'WARNING',
        'FECHA_EMISION_FORMATO',
        `No se pudo interpretar la fecha de emisión "${emision.raw}".`,
        'Fecha de Emisión',
        emision.raw,
      );
    } else if (emision.problem === 'FUERA_DE_RANGO') {
      agregar(
        'WARNING',
        'FECHA_FUERA_DE_RANGO',
        `La fecha de emisión "${emision.raw}" no existe en el calendario.`,
        'Fecha de Emisión',
        emision.raw,
      );
    } else if (emision.problem === 'AMBIGUA') {
      agregar(
        'WARNING',
        'FECHA_AMBIGUA',
        `La fecha "${emision.raw}" es ambigua; se interpretó como día/mes.`,
        'Fecha de Emisión',
        emision.raw,
      );
    }

    const compromiso = parseDate(valor(fila, indices.commitmentDate));
    if (compromiso.problem === 'FORMATO' || compromiso.problem === 'FUERA_DE_RANGO') {
      agregar(
        'WARNING',
        'FECHA_COMPROMISO_FORMATO',
        `No se pudo interpretar la fecha de compromiso "${compromiso.raw}".`,
        'Fecha de Compromiso',
        compromiso.raw,
      );
    }

    // --- Estado (catálogo, nunca coincidencia textual suelta) ----------------
    const statusRaw = toText(valor(fila, indices.status)).trim();
    const estadoEncontrado = indiceEstados.get(normalizeKey(statusRaw)) ?? null;

    let statusId = estadoEncontrado?.id ?? null;
    let isCancelled = false;
    let countsEconomically = true;

    if (estadoEncontrado) {
      const completo = estadoEncontrado as StatusCatalogEntry;
      isCancelled = completo.isCancelled;
      countsEconomically = completo.countsEconomically;
    } else {
      agregar(
        'WARNING',
        'ESTADO_DESCONOCIDO',
        statusRaw === ''
          ? 'La fila no tiene estado.'
          : `El estado "${statusRaw}" no está en el catálogo; queda pendiente de clasificar.`,
        'Estado',
        statusRaw,
      );
      if (estadoDesconocido) {
        statusId = estadoDesconocido.id;
        isCancelled = estadoDesconocido.isCancelled;
        countsEconomically = estadoDesconocido.countsEconomically;
      } else {
        countsEconomically = false;
      }
    }

    // --- Tipo de orden y de contratación -------------------------------------
    const orderTypeRaw = toText(valor(fila, indices.orderType)).trim();
    const orderTypeId = orderTypeRaw
      ? (indiceTiposOrden.get(normalizeKey(orderTypeRaw))?.id ?? null)
      : null;

    const contractTypeRaw = toText(valor(fila, indices.contractType)).trim();
    const contractTypeId = contractTypeRaw
      ? (indiceTiposContrato.get(normalizeKey(contractTypeRaw))?.id ?? null)
      : null;

    // --- Gestión -------------------------------------------------------------
    const managementPeriodId = buscarGestion(emision.value, managementPeriods);
    if (emision.value && !managementPeriodId) {
      agregar(
        'INFO',
        'SIN_GESTION',
        `La fecha ${emision.value.toISOString().slice(0, 10)} no cae en ninguna gestión registrada.`,
        'Fecha de Emisión',
      );
    }

    // --- Deduplicación dentro del lote ---------------------------------------
    const dedupeKey =
      orderNumber !== '' && rucParsed.value
        ? buildDedupeKey({
            orderNumber,
            orderType: toText(valor(fila, indices.orderType)),
            ruc: rucParsed.value,
            amount: monto.value,
            issueDate: emision.value,
          })
        : null;

    if (dedupeKey) {
      const anterior = vistos.get(dedupeKey);
      if (anterior !== undefined) {
        agregar(
          'WARNING',
          'DUPLICADO_EN_LOTE',
          `Registro repetido: ya aparece en la fila ${anterior} del mismo archivo.`,
        );
      } else {
        vistos.set(dedupeKey, sourceRow);
      }
    }

    // --- Número correlativo --------------------------------------------------
    const rowNumberTexto = toText(valor(fila, indices.rowNumber)).trim();
    const rowNumber = /^[0-9]+$/.test(rowNumberTexto) ? Number(rowNumberTexto) : null;

    // --- Descripción y SIAF --------------------------------------------------
    const descriptionTexto = toText(valor(fila, indices.description)).trim();
    const siafTexto = toText(valor(fila, indices.siafNumber)).trim();

    const hasError = propios.some((i) => i.severity === 'ERROR');
    const hasWarning = propios.some((i) => i.severity === 'WARNING');

    issues.push(...propios);

    if (hasError) {
      errorRows++;
      return;
    }

    if (hasWarning) warningRows++;
    if (isCancelled) cancelledRows++;

    // Solo se suman al económico los montos que se entienden y que cuentan.
    if (monto.value) {
      const centavos = decimalACentavos(monto.value);
      registeredCents += centavos;
      if (isCancelled || !countsEconomically) cancelledCents += centavos;
    }

    orders.push({
      sourceRow,
      rowNumber,
      orderNumber,
      orderTypeId,
      orderTypeRaw: orderTypeRaw || null,
      contractTypeId,
      contractTypeRaw: contractTypeRaw || null,
      description: descriptionTexto || null,
      siafNumber: siafTexto || null,
      issueDate: emision.value,
      commitmentDate: compromiso.value,
      statusId,
      statusRaw: statusRaw || null,
      isCancelled,
      countsEconomically,
      amount: monto.value,
      rawAmount: monto.value ? null : monto.raw || null,
      ruc: rucParsed.value,
      supplierName: supplierName || null,
      supplierType: rucParsed.value
        ? rucParsed.value.startsWith('10')
          ? 'PERSONA_NATURAL'
          : rucParsed.value.startsWith('20')
            ? 'PERSONA_JURIDICA'
            : 'OTRO'
        : 'DESCONOCIDO',
      managementPeriodId,
      rawData: rowToRawObject(headers, fila),
      dedupeKey,
      issues: propios,
      hasError,
      hasWarning,
    });
  });

  // Segunda pasada: compara únicamente órdenes válidas, vigentes y con monto positivo.
  // Las anuladas o no económicas quedan para trazabilidad, pero no deben bloquear
  // la importación por umbrales que solo afectan al monto considerado.
  // La mediana resiste una cifra enorme aislada mejor que el promedio.
  const positivos = orders.filter(o => o.amount !== null && !o.isCancelled && o.countsEconomically && Number(o.amount) > 0)
    .map(o => Number(o.amount)).sort((a, b) => a - b);
  const mitad = Math.floor(positivos.length / 2);
  const mediana = positivos.length >= 5
    ? positivos.length % 2 ? positivos[mitad]! : (positivos[mitad - 1]! + positivos[mitad]!) / 2
    : null;
  const moneda = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  for (const orden of orders) {
    if (orden.amount === null) continue;
    if (orden.isCancelled || !orden.countsEconomically) continue;
    const monto = Number(orden.amount);
    const hallazgos: ValidationIssue[] = [];
    const advertir = (code: IssueCode, message: string) => hallazgos.push({
      severity: 'WARNING', code, message, sourceRow: orden.sourceRow,
      columnName: headers[indices.amount ?? -1] || 'Monto',
      rawValue: toText(orden.rawData[headers[indices.amount ?? -1] ?? '']),
    });
    if (orden.ruc && monto === Number(orden.ruc)) {
      advertir('MONTO_COINCIDE_RUC', `El monto ${moneda(monto)} coincide con el RUC del proveedor. Revisa la celda y el mapeo de columnas.`);
    }
    if (monto > MONTO_ALTO_SOLES) {
      advertir('MONTO_ALTO', `Monto elevado: ${moneda(monto)}. Al superar ${moneda(MONTO_ALTO_SOLES)} se exige revisión; es una alerta de calidad, no un límite legal.`);
    }
    if (mediana !== null && monto >= MONTO_ATIPICO_MINIMO_SOLES && monto > mediana * FACTOR_MONTO_ATIPICO) {
      advertir('MONTO_ATIPICO', `El monto ${moneda(monto)} supera ${FACTOR_MONTO_ATIPICO} veces la mediana del libro (${moneda(mediana)}). Revisa posibles errores de digitación, separadores o columnas.`);
    }
    if (!hallazgos.length) continue;
    if (!orden.hasWarning) warningRows++;
    orden.hasWarning = true;
    orden.issues.push(...hallazgos);
    issues.push(...hallazgos);
  }

  return {
    orders,
    issues,
    summary: {
      totalRows: rows.length,
      successfulRows: orders.length,
      warningRows,
      errorRows,
      cancelledRows,
      registeredCents,
      cancelledCents,
      consideredCents: registeredCents - cancelledCents,
    },
  };
}
