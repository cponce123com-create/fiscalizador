import { prisma } from '@/lib/prisma';
import { ErrorDeNegocio, NoEncontrado } from '@/lib/errors';
import { Prisma } from '@/lib/generated/prisma/client';
import { contextoDePeticion, registrarAuditoria, type ClienteDb } from '@/services/auditService';
import {
  camposObligatoriosFaltantes,
  indicesPorCampo,
  mapColumns,
  type ColumnMapping,
  type InternalField,
} from '@/services/mappingService';
import { computeChecksum, parseSpreadsheet, type RawSheet } from '@/services/parseService';
import { describirFalloDeAlmacenamiento, getStorage } from '@/services/storageService';
import { recalcularResumenGestion, resolverProveedor } from '@/services/supplierService';
import {
  validateRows,
  type ManagementPeriodEntry,
  type StatusCatalogEntry,
  type ValidatedOrder,
  type ValidationIssue,
  type ValidationSummary,
} from '@/services/validationService';

/**
 * Orquestación del importador, en dos fases.
 *
 * FASE 1 — `analizar`: lee el archivo, propone el mapeo de columnas, valida fila
 * a fila y guarda el archivo original. NO inserta ni una sola orden.
 *
 * FASE 2 — `confirmar`: vuelve a leer el archivo GUARDADO EN EL SERVIDOR y lo
 * inserta todo en una única transacción.
 *
 * El re-parseo de la fase 2 no es un capricho: la sección 25 del pliego exige no
 * confiar en datos enviados desde el navegador. Si el cliente pudiera enviar las
 * filas ya normalizadas, podría insertar registros que no existen en el archivo
 * original. Releyendo el archivo guardado, lo que entra en la base de datos es
 * exactamente lo que había en el libro.
 */

export type ImportTypeValue = 'ORDENES_COMPRA' | 'ORDENES_SERVICIO' | 'CONSOLIDADO';

export type Catalogos = {
  statuses: StatusCatalogEntry[];
  orderTypes: { id: string; code: string; label: string; aliases: string[] }[];
  contractTypes: { id: string; code: string; label: string; aliases: string[] }[];
  managementPeriods: ManagementPeriodEntry[];
};

export type AnalizarInput = {
  buffer: Buffer;
  originalFilename: string;
  year: number;
  month: number;
  importType: ImportTypeValue;
  userId: string | null;
  sourceUrl?: string;
  coverageComplete?: boolean;
};

export type LotePrevio = {
  id: string;
  originalFilename: string;
  period: string;
  version: number;
  status: string;
  uploadedAt: Date;
  totalRows: number;
};

export type AnalizarResult = {
  importBatchId: string;
  checksum: string;
  sheetName: string;
  sheetNames: string[];
  headerRowIndex: number;
  version: number;
  columns: ColumnMapping[];
  camposFaltantes: InternalField[];
  preview: PreviewRow[];
  summary: ValidationSummary;
  issues: ValidationIssue[];
  /** Lotes anteriores del mismo periodo, que hay que resolver antes de confirmar. */
  lotesMismoPeriodo: LotePrevio[];
  /** Lote ya importado con exactamente el mismo contenido. */
  loteMismoChecksum: LotePrevio | null;
  /** Cuánto de este libro ya está en el portal, comparando por contenido. */
  duplicadoContenido: DuplicadoContenido;
  /**
   * Datos de las filas que se importarían y tienen algún hallazgo, con sus hallazgos.
   *
   * Se devuelven aparte de la vista previa porque son las que el administrador tiene
   * que juzgar: un mensaje suelto («el monto no se pudo interpretar») no dice de qué
   * fila se trata, y sin los datos de la fila no hay forma de decidir si se deja
   * fuera. Las filas con ERROR no están aquí: no se importan, así que no hay nada que
   * decidir sobre ellas.
   */
  filasConHallazgos: PreviewRow[];
};

export type PreviewRow = {
  sourceRow: number;
  orderNumber: string;
  ruc: string | null;
  supplierName: string | null;
  amount: string | null;
  issueDate: string | null;
  statusRaw: string | null;
  isCancelled: boolean;
  issues: ValidationIssue[];
};

export type ConfirmarResult = {
  importBatchId: string;
  status: 'COMPLETED' | 'COMPLETED_WITH_WARNINGS';
  ordenesInsertadas: number;
  /** Filas que no se insertaron porque ya estaban en el portal. */
  ordenesOmitidasPorDuplicado: number;
  /** Filas que no se insertaron porque el administrador las dejó fuera. */
  ordenesExcluidasPorDecision: number;
  proveedoresCreados: number;
  proveedoresExistentes: number;
  variantesDetectadas: number;
  summary: ValidationSummary;
};

const LIMITE_PREVIEW = 10;

/** Tope de filas con hallazgos que se devuelven para revisarlas una a una. */
const LIMITE_FILAS_CON_HALLAZGOS = 500;

/**
 * Un lote en `PROCESSING` se considera colgado si lleva más de este tiempo sin
 * terminar. Una importación normal tarda segundos, así que diez minutos es margen
 * de sobra y permite recuperar el trabajo de un proceso que murió a mitad (un
 * reinicio del servicio, por ejemplo) en lugar de dejarlo atascado para siempre.
 */
export const PROCESO_CADUCADO_MS = 10 * 60 * 1000;

/** ¿El lote lleva demasiado tiempo procesándose y puede darse por perdido? */
function procesoCaducado(iniciadoEn: Date | null, ahora: Date): boolean {
  // Sin fecha no hay forma de saber si sigue vivo, y bloquearlo para siempre sería
  // peor: se trata como caducado.
  if (!iniciadoEn) return true;
  return ahora.getTime() - iniciadoEn.getTime() > PROCESO_CADUCADO_MS;
}

/**
 * Toma el lote para procesarlo con una transición atómica.
 *
 * Solo pasa a `PROCESSING` si estaba en un estado reclamable (VALIDATING, UPLOADED,
 * FAILED) o si llevaba colgado en `PROCESSING` más de `PROCESO_CADUCADO_MS`. Si dos
 * peticiones se cruzan, una actualiza la fila y la otra obtiene `count = 0`: esa es
 * la garantía de que el lote no se procesa dos veces a la vez.
 */
async function reclamarLote(id: string, ahora: Date): Promise<boolean> {
  const limite = new Date(ahora.getTime() - PROCESO_CADUCADO_MS);

  const { count } = await prisma.importBatch.updateMany({
    where: {
      id,
      OR: [
        { status: { in: ['UPLOADED', 'VALIDATING', 'FAILED'] } },
        {
          status: 'PROCESSING',
          OR: [{ processingStartedAt: null }, { processingStartedAt: { lt: limite } }],
        },
      ],
    },
    data: {
      status: 'PROCESSING',
      processingStartedAt: ahora,
      processingFinishedAt: null,
      errorMessage: null,
    },
  });

  return count === 1;
}

/**
 * ¿Es un choque con la clave única `(year, month, importType, version)`?
 *
 * Prisma marca las violaciones de restricciones con el código `P2002`, y en
 * `ImportBatch` la única restricción única es esa, así que no hay ambigüedad.
 */
function esColisionDeVersion(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Crea el lote con la primera versión libre del periodo.
 *
 * La versión se calcula leyendo la máxima y sumando uno, así que dos análisis del
 * mismo periodo a la vez pueden calcular la misma. Cuando eso ocurre, el segundo
 * `create` choca con la clave única: en vez de devolver un error interno, se
 * recalcula la versión y se reintenta una vez. Si vuelve a chocar, se avisa con un
 * error de negocio, nunca con un 500.
 */
async function crearLoteConVersionLibre(
  datos: Omit<Prisma.ImportBatchUncheckedCreateInput, 'version'>,
): Promise<{ id: string; version: number }> {
  for (let intento = 1; intento <= 2; intento++) {
    const ultima = await prisma.importBatch.findFirst({
      where: { year: datos.year, month: datos.month, importType: datos.importType },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    try {
      return await prisma.importBatch.create({
        data: { ...datos, version: (ultima?.version ?? 0) + 1 },
        select: { id: true, version: true },
      });
    } catch (error) {
      if (!esColisionDeVersion(error)) throw error;
      // Choque de versión: se reintenta recalculándola.
    }
  }

  throw new ErrorDeNegocio(
    'Otro análisis del mismo periodo se adelantó y no quedó una versión libre. ' +
      'Vuelve a intentarlo.',
  );
}

/** Periodo en formato `YYYY-MM`. */
export function periodoDe(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Periodo `YYYY-MM` que aparece en el nombre del archivo, si lo trae.
 *
 * El portal no siempre nombra los libros con su mes (`Lista-OCOS (5).xls`), así
 * que esto es solo una pista para contrastar con el contenido, nunca la fuente de
 * verdad.
 */
export function periodoEnNombre(nombreArchivo: string): string | null {
  const coincidencia = nombreArchivo.match(/(?<!\d)(20\d{2})[-_. ]?(0?[1-9]|1[0-2])(?!\d)/);
  if (!coincidencia) return null;

  const anio = coincidencia[1] as string;
  const mes = (coincidencia[2] as string).padStart(2, '0');
  return `${anio}-${mes}`;
}

export type PeriodoDetectado = {
  /** Mes con más filas con fecha de emisión legible. */
  periodoSugerido: string | null;
  /** Periodo que trae el nombre del archivo, si lo trae. */
  periodoDelNombre: string | null;
  /** Todos los meses presentes, de más a menos filas. */
  mesesDetectados: { periodo: string; filas: number }[];
  filasLeidas: number;
  /** `null` si el nombre no trae periodo o si ninguna fila tiene fecha. */
  coincideConElNombre: boolean | null;
};

/** `YYYY-MM` en UTC: las fechas son `@db.Date` y se guardan a medianoche UTC. */
function mesDe(fecha: Date): string {
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Deduce a qué mes corresponde un libro a partir de las fechas de emisión de sus
 * filas.
 *
 * Existe porque importar un año entero son doce libros, y elegir doce meses a mano
 * es donde más se equivoca uno. Reutiliza `procesarBuffer`, el mismo pipeline que
 * analizar y confirmar, para que el mes deducido sea exactamente el que se va a
 * importar.
 *
 * NO escribe nada: ni base de datos, ni archivo original.
 */
export async function detectarPeriodo(
  buffer: Buffer,
  nombreArchivo: string,
): Promise<PeriodoDetectado> {
  const catalogos = await cargarCatalogos();
  const { validacion } = procesarBuffer(buffer, catalogos);

  const conteo = new Map<string, number>();
  for (const orden of validacion.orders) {
    if (!orden.issueDate) continue;
    const periodo = mesDe(orden.issueDate);
    conteo.set(periodo, (conteo.get(periodo) ?? 0) + 1);
  }

  const mesesDetectados = [...conteo.entries()]
    .map(([periodo, filas]) => ({ periodo, filas }))
    .sort((a, b) => b.filas - a.filas || a.periodo.localeCompare(b.periodo));

  const periodoSugerido = mesesDetectados[0]?.periodo ?? null;
  const periodoDelNombre = periodoEnNombre(nombreArchivo);

  return {
    periodoSugerido,
    periodoDelNombre,
    mesesDetectados,
    filasLeidas: validacion.summary.totalRows,
    coincideConElNombre:
      periodoDelNombre === null || periodoSugerido === null
        ? null
        : periodoDelNombre === periodoSugerido,
  };
}

export type DuplicadoContenido = {
  /** Filas del libro que todavía no están en el portal. */
  filasNuevas: number;
  /** Filas del libro que ya están en el portal (misma clave de deduplicación). */
  filasRepetidas: number;
  /** Lotes anteriores que ya contienen alguna de esas filas. */
  lotes: LotePrevio[];
};

/**
 * Compara las claves de deduplicación del libro con las que ya están guardadas.
 *
 * Detectar por CONTENIDO y no solo por la huella del archivo es lo que reconoce un
 * libro re-descargado del portal: los mismos datos con bytes distintos. La huella
 * (checksum) solo ve archivos idénticos byte a byte.
 *
 * Las filas sin clave (sin número de orden o sin RUC) quedan fuera del recuento: no
 * se pueden comparar y se insertan siempre.
 */
export async function analizarDuplicadosDeContenido(claves: string[]): Promise<DuplicadoContenido> {
  const conClave = claves.filter((clave) => clave !== '');
  const unicas = [...new Set(conClave)];

  if (unicas.length === 0) {
    return { filasNuevas: 0, filasRepetidas: 0, lotes: [] };
  }

  const existentes = await prisma.order.findMany({
    where: { dedupeKey: { in: unicas }, importBatch: { isCurrent: true } },
    select: { dedupeKey: true, importBatchId: true },
  });

  const clavesExistentes = new Set(existentes.map((fila) => fila.dedupeKey));
  const filasRepetidas = conClave.filter((clave) => clavesExistentes.has(clave)).length;

  const idsLotes = [...new Set(existentes.map((fila) => fila.importBatchId))];
  const lotes =
    idsLotes.length === 0
      ? []
      : await prisma.importBatch.findMany({
          where: { id: { in: idsLotes } },
          orderBy: { uploadedAt: 'desc' },
          select: {
            id: true,
            originalFilename: true,
            period: true,
            version: true,
            status: true,
            uploadedAt: true,
            totalRows: true,
          },
        });

  return {
    filasNuevas: conClave.length - filasRepetidas,
    filasRepetidas,
    lotes,
  };
}

export async function cargarCatalogos(db: ClienteDb = prisma): Promise<Catalogos> {
  const [statuses, orderTypes, contractTypes, gestiones] = await Promise.all([
    db.orderStatus.findMany({ where: { isActive: true }, orderBy: { position: 'asc' } }),
    db.orderType.findMany({ where: { isActive: true }, orderBy: { position: 'asc' } }),
    db.contractType.findMany({ where: { isActive: true }, orderBy: { position: 'asc' } }),
    db.managementPeriod.findMany({ orderBy: { startDate: 'asc' } }),
  ]);

  return {
    statuses: statuses.map((s) => ({
      id: s.id,
      code: s.code,
      label: s.label,
      aliases: s.aliases,
      countsEconomically: s.countsEconomically,
      isCancelled: s.isCancelled,
      isUnknown: s.isUnknown,
    })),
    orderTypes: orderTypes.map((t) => ({
      id: t.id,
      code: t.code,
      label: t.label,
      aliases: t.aliases,
    })),
    contractTypes: contractTypes.map((t) => ({
      id: t.id,
      code: t.code,
      label: t.label,
      aliases: t.aliases,
    })),
    managementPeriods: gestiones.map((g) => ({
      id: g.id,
      name: g.name,
      startDate: g.startDate,
      endDate: g.endDate,
    })),
  };
}

function aPreview(orden: ValidatedOrder): PreviewRow {
  return {
    sourceRow: orden.sourceRow,
    orderNumber: orden.orderNumber,
    ruc: orden.ruc,
    supplierName: orden.supplierName,
    amount: orden.amount,
    issueDate: orden.issueDate ? orden.issueDate.toISOString().slice(0, 10) : null,
    statusRaw: orden.statusRaw,
    isCancelled: orden.isCancelled,
    issues: orden.issues,
  };
}

/**
 * Ejecuta el pipeline de lectura + mapeo + validación sobre un buffer.
 *
 * Se extrae para que `analizar` y `confirmar` compartan EXACTAMENTE la misma
 * lógica. Si divergieran, lo validado y lo importado no serían lo mismo.
 *
 * `filasExcluidas` son los números de fila que el administrador dejó fuera al revisar
 * los hallazgos. Se descartan aquí, antes de que nadie las use: si se filtraran más
 * tarde, una fila excluida todavía crearía su proveedor y su resumen por gestión.
 * El resumen de validación NO cambia: describe el archivo, no lo que se importa.
 */
function procesarBuffer(
  buffer: Buffer,
  catalogos: Catalogos,
  mappingOverride?: { position: number; field: InternalField | null; isPublic: boolean }[],
  filasExcluidas: readonly number[] = [],
) {
  const hoja: RawSheet = parseSpreadsheet(buffer);
  const mappings = mapColumns(hoja.headers, hoja.rows);

  // El administrador puede haber corregido el mapeo en la fase 1; sus
  // correcciones mandan sobre la propuesta automática.
  const mappingsFinales = mappingOverride
    ? mappings.map((m) => {
        const correccion = mappingOverride.find((o) => o.position === m.position);
        if (!correccion) return m;
        return { ...m, field: correccion.field, isPublic: correccion.isPublic };
      })
    : mappings;

  const indices = indicesPorCampo(mappingsFinales);

  const validacion = validateRows({
    headers: hoja.headers,
    rows: hoja.rows,
    sourceRows: hoja.sourceRows,
    indices,
    headerRowIndex: hoja.headerRowIndex,
    statuses: catalogos.statuses,
    orderTypes: catalogos.orderTypes,
    contractTypes: catalogos.contractTypes,
    managementPeriods: catalogos.managementPeriods,
  });

  const excluidas = new Set(filasExcluidas);

  if (excluidas.size === 0) {
    return { hoja, mappings: mappingsFinales, validacion };
  }

  return {
    hoja,
    mappings: mappingsFinales,
    validacion: {
      ...validacion,
      orders: validacion.orders.filter((orden) => !excluidas.has(orden.sourceRow)),
    },
  };
}

/**
 * Guarda el archivo original, traduciendo el fallo si el disco no lo admite.
 *
 * El archivo original NUNCA se descarta (es la evidencia de la que sale cada dato),
 * así que si no se puede guardar la importación se detiene. Pero se detiene
 * diciendo por qué: un fallo de almacenamiento sin explicación es indistinguible de
 * un error del programa, y en un servidor eso obliga a leer los registros para
 * averiguar algo tan simple como que el directorio no existe.
 */
async function guardarArchivoOriginal(buffer: Buffer, filename: string, checksum: string) {
  try {
    return await getStorage().save({ buffer, filename, checksum });
  } catch (error) {
    console.error('No se pudo guardar el archivo original de la importación:', error);

    throw new ErrorDeNegocio(
      'No se pudo guardar el archivo original en el almacenamiento ' +
        `(${describirFalloDeAlmacenamiento(error)}). Revisa STORAGE_LOCAL_DIR: el ` +
        'directorio tiene que existir y el servicio tiene que poder escribir en él.',
    );
  }
}

/**
 * FASE 1 — analizar.
 *
 * Guarda el archivo original y deja un `ImportBatch` en estado VALIDATING con
 * las columnas detectadas y los hallazgos. No crea ninguna orden.
 */
export async function analizar(input: AnalizarInput): Promise<AnalizarResult> {
  const { buffer, originalFilename, year, month, importType, userId } = input;

  const catalogos = await cargarCatalogos();
  const checksum = computeChecksum(buffer);
  const periodo = periodoDe(year, month);

  const { hoja, mappings, validacion } = procesarBuffer(buffer, catalogos);
  const camposFaltantes = camposObligatoriosFaltantes(mappings);

  const claves = validacion.orders.map((o) => o.dedupeKey ?? '');

  // Duplicados: mismo contenido exacto (huella), mismo periodo ya importado, o
  // filas que ya están en el portal aunque el archivo sea distinto.
  const [loteMismoChecksum, lotesMismoPeriodo, duplicadoContenido] = await Promise.all([
    prisma.importBatch.findFirst({
      where: { checksum, status: { in: ['COMPLETED', 'COMPLETED_WITH_WARNINGS'] } },
      select: {
        id: true,
        originalFilename: true,
        period: true,
        version: true,
        status: true,
        uploadedAt: true,
        totalRows: true,
      },
    }),
    prisma.importBatch.findMany({
      where: { year, month, importType },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        originalFilename: true,
        period: true,
        version: true,
        status: true,
        uploadedAt: true,
        totalRows: true,
      },
    }),
    analizarDuplicadosDeContenido(claves),
  ]);

  // El archivo original se guarda SIEMPRE, antes de cualquier decisión.
  const almacenado = await guardarArchivoOriginal(buffer, originalFilename, checksum);

  // Gestión: si todas las filas caen en la misma, se deja fijada en el lote.
  const gestiones = new Set(
    validacion.orders.map((o) => o.managementPeriodId).filter((v): v is string => v !== null),
  );
  const managementPeriodId = gestiones.size === 1 ? [...gestiones][0]! : null;

  // La versión la asigna el helper, que reintenta si otro análisis del mismo
  // periodo se adelantó y chocó con la clave única (year, month, importType, version).
  const lote = await crearLoteConVersionLibre({
    filename: almacenado.key,
    originalFilename,
    year,
    month,
    period: periodo,
    importType,
    checksum,
    status: 'VALIDATING',
    sheetName: hoja.sheetName,
    sourceUrl: input.sourceUrl || null,
    coverageComplete: input.coverageComplete ?? false,
    totalRows: validacion.summary.totalRows,
    successfulRows: validacion.summary.successfulRows,
    warningRows: validacion.summary.warningRows,
    errorRows: validacion.summary.errorRows,
    storageKey: almacenado.key,
    originalFileUrl: almacenado.url,
    uploadedById: userId,
    managementPeriodId,
    columns: {
      create: mappings.map((m) => ({
        position: m.position,
        originalName: m.originalName,
        internalField: m.field,
        dataType: m.dataType,
        isPublic: m.isPublic,
        isRequired: m.isRequired,
        confidence: m.confidence,
        sampleValues: m.sampleValues,
      })),
    },
    issues: {
      create: validacion.issues.slice(0, 500).map((i) => ({
        severity: i.severity,
        code: i.code,
        message: i.message,
        sourceRow: i.sourceRow,
        columnName: i.columnName ?? null,
        rawValue: i.rawValue ?? null,
      })),
    },
  });

  return {
    importBatchId: lote.id,
    checksum,
    sheetName: hoja.sheetName,
    sheetNames: hoja.sheetNames,
    headerRowIndex: hoja.headerRowIndex,
    version: lote.version,
    columns: mappings,
    camposFaltantes,
    preview: validacion.orders.slice(0, LIMITE_PREVIEW).map(aPreview),
    // Las que hay que juzgar: se importarían, pero traen algo que revisar.
    filasConHallazgos: validacion.orders
      .filter((orden) => orden.issues.length > 0)
      .slice(0, LIMITE_FILAS_CON_HALLAZGOS)
      .map(aPreview),
    summary: validacion.summary,
    issues: validacion.issues,
    lotesMismoPeriodo,
    loteMismoChecksum,
    duplicadoContenido,
  };
}

export type ConfirmarInput = {
  importBatchId: string;
  userId: string | null;
  request?: Request;
  /** Correcciones de mapeo que el administrador hizo en la fase 1. */
  mappingOverride?: { position: number; field: InternalField | null; isPublic: boolean }[];
  /** Confirmación explícita de reimportar un periodo ya existente. */
  reemplazarPeriodo?: boolean;
  sourceUrl?: string;
  coverageComplete?: boolean;
  /**
   * Compatibilidad con clientes anteriores: ya no se omiten filas de versiones
   * históricas. La sustitución de instantáneas evita sumarlas dos veces.
   */
  omitirDuplicados?: boolean;
  /**
   * Números de fila del libro que el administrador dejó fuera a propósito, después
   * de revisar sus hallazgos. Se descartan antes de insertar, así que tampoco cuentan
   * para los proveedores ni para los resúmenes por gestión.
   */
  filasExcluidas?: number[];
};

/**
 * FASE 2 — confirmar.
 *
 * Vuelve a leer el archivo guardado en el servidor y escribe todo en una única
 * transacción. Si cualquier paso falla, no queda nada a medias.
 */
export async function confirmar(input: ConfirmarInput): Promise<ConfirmarResult> {
  const {
    importBatchId,
    userId,
    request,
    mappingOverride,
    reemplazarPeriodo,
    filasExcluidas = [],
  } = input;

  if (input.sourceUrl) {
    let valido = false;
    try { const url = new URL(input.sourceUrl); valido = ['http:', 'https:'].includes(url.protocol) && input.sourceUrl.length <= 500; } catch { /* URL inválida. */ }
    if (!valido) throw new ErrorDeNegocio('La fuente debe ser una URL http(s) válida de hasta 500 caracteres.');
  }
  const lote = await prisma.importBatch.findUnique({ where: { id: importBatchId } });
  if (!lote) throw new NoEncontrado(`No existe el lote de importación ${importBatchId}.`);

  const ahora = new Date();
  const procesoColgado =
    lote.status === 'PROCESSING' && procesoCaducado(lote.processingStartedAt, ahora);

  // Guarda temprana, solo para dar el mensaje correcto: la transición atómica de
  // más abajo es la que de verdad decide quién procesa el lote.
  if (lote.status === 'PROCESSING' && !procesoColgado) {
    throw new ErrorDeNegocio('Ese lote ya se está procesando.');
  }
  if (lote.status === 'COMPLETED' || lote.status === 'COMPLETED_WITH_WARNINGS') {
    throw new ErrorDeNegocio(
      'Ese lote ya fue importado. Crea una versión nueva en lugar de repetirlo.',
    );
  }
  if (!lote.storageKey) {
    throw new ErrorDeNegocio('El lote no tiene archivo asociado; no se puede reimportar.');
  }

  // Aviso de duplicado: si el periodo ya está importado y el administrador no lo
  // ha confirmado explícitamente, se detiene. NUNCA se reemplaza en silencio
  // (sección 8 del pliego).
  const previos = await prisma.importBatch.count({
    where: {
      year: lote.year,
      month: lote.month,
      importType: lote.importType,
      id: { not: lote.id },
      status: { in: ['COMPLETED', 'COMPLETED_WITH_WARNINGS'] },
    },
  });

  if (previos > 0 && !reemplazarPeriodo) {
    throw new ErrorDeNegocio(
      `Ya existe ${previos} importación(es) completada(s) para el periodo ${lote.period}. ` +
        'Confirma explícitamente que quieres importar una versión nueva.',
    );
  }

  // Transición atómica: de VALIDATING (o de un PROCESSING caducado) a PROCESSING.
  // Si dos peticiones se cruzan, solo una pasa; la otra recibe un error claro en
  // lugar de que las dos escriban a la vez.
  const reclamado = await reclamarLote(lote.id, ahora);

  if (!reclamado) {
    const actual = await prisma.importBatch.findUnique({
      where: { id: lote.id },
      select: { status: true },
    });

    if (actual?.status === 'PROCESSING') {
      throw new ErrorDeNegocio('Ese lote ya se está procesando.');
    }
    if (actual?.status === 'COMPLETED' || actual?.status === 'COMPLETED_WITH_WARNINGS') {
      throw new ErrorDeNegocio(
        'Ese lote ya fue importado. Crea una versión nueva en lugar de repetirlo.',
      );
    }
    throw new ErrorDeNegocio('No se pudo empezar a procesar el lote; vuelve a intentarlo.');
  }

  // Un lote que estaba colgado en PROCESSING se recupera, y eso queda auditado:
  // alguien tiene que poder ver que se reanudó un trabajo que había quedado a medias.
  if (procesoColgado) {
    const contexto = request ? contextoDePeticion(request) : { ip: null, userAgent: null };
    await registrarAuditoria(prisma, {
      userId,
      action: 'UPDATE',
      entity: 'ImportBatch',
      entityId: lote.id,
      ip: contexto.ip,
      userAgent: contexto.userAgent,
      metadata: {
        recuperacion: 'proceso caducado',
        period: lote.period,
        version: lote.version,
        processingStartedAt: lote.processingStartedAt?.toISOString() ?? null,
      },
    });
  }

  try {
    const catalogos = await cargarCatalogos();
    const buffer = await getStorage().read(lote.storageKey);
    if (computeChecksum(buffer) !== lote.checksum) {
      throw new ErrorDeNegocio('La huella del archivo no coincide con el original. No se publicó la importación.');
    }
    const { validacion } = procesarBuffer(buffer, catalogos, mappingOverride, filasExcluidas);

    const { ip, userAgent } = request
      ? contextoDePeticion(request)
      : { ip: null, userAgent: null };

    // Las que el administrador dejó fuera: la diferencia entre lo que el archivo tenía
    // válido y lo que queda por importar.
    const ordenesExcluidasPorDecision =
      validacion.summary.successfulRows - validacion.orders.length;

    let proveedoresCreados = 0;
    let proveedoresExistentes = 0;
    let variantesDetectadas = 0;
    let ordenesInsertadas = 0;
    let ordenesOmitidasPorDuplicado = 0;

    // El grueso del trabajo va en UNA transacción. El timeout se amplía porque
    // un libro grande puede tardar; en Render el límite de la petición es menor,
    // así que los libros muy grandes necesitarán el worker de una fase posterior.
    await prisma.$transaction(
      async (tx) => {
        // Bloqueo por periodo: OC, OS y consolidado comparten el mismo universo.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lote.year}, ${lote.month})`;
        const vigentes = await tx.importBatch.findMany({
          where: { year: lote.year, month: lote.month, isCurrent: true, id: { not: lote.id } },
        });
        if (lote.importType !== 'CONSOLIDADO' && vigentes.some((b) => b.importType === 'CONSOLIDADO')) {
          throw new ErrorDeNegocio('El periodo tiene un consolidado vigente. Reemplázalo con un consolidado completo para no perder OC u OS.');
        }
        const anteriores = vigentes.filter((b) => lote.importType === 'CONSOLIDADO' || b.importType === lote.importType);
        if (anteriores.length > 0 && !reemplazarPeriodo) {
          throw new ErrorDeNegocio('El periodo ya tiene una versión vigente. Confirma la sustitución de la instantánea completa.');
        }
        const historicos = await tx.importBatch.findMany({where:{year:lote.year,month:lote.month,id:{not:lote.id},status:{in:['COMPLETED','COMPLETED_WITH_WARNINGS']}, ...(lote.importType==='CONSOLIDADO'?{}:{importType:lote.importType})},select:{id:true}});
        const idsAnteriores = historicos.map((b) => b.id);
        const paresAnteriores = await tx.order.findMany({
          where: { importBatchId: { in: idsAnteriores } },
          select: { supplierId: true, managementPeriodId: true },
          distinct: ['supplierId', 'managementPeriodId'],
        });
        await tx.importBatch.updateMany({ where: { id: { in: idsAnteriores } }, data: { isCurrent: false, requiresReview: false } });

        // 1. Proveedores: se resuelven una sola vez por RUC.
        const rucsUnicos = new Map<string, { name: string | null; fecha: Date | null }>();
        for (const orden of validacion.orders) {
          if (!orden.ruc) continue;
          if (!rucsUnicos.has(orden.ruc)) {
            rucsUnicos.set(orden.ruc, {
              name: orden.supplierName,
              fecha: orden.issueDate,
            });
          }
        }

        const idPorRuc = new Map<string, string>();

        for (const [ruc, datos] of rucsUnicos) {
          const resuelto = await resolverProveedor(tx, {
            ruc,
            name: datos.name,
            fechaVista: datos.fecha,
          });
          idPorRuc.set(ruc, resuelto.supplierId);
          if (resuelto.existia) proveedoresExistentes++;
          else proveedoresCreados++;
          if (resuelto.varianteDetectada) variantesDetectadas++;
        }

        // 2. Órdenes: en una sola sentencia en lugar de fila por fila.
        const filas = validacion.orders
          .filter((o) => o.ruc !== null && idPorRuc.has(o.ruc))
          .map((o) => ({
            importBatchId: lote.id,
            rowNumber: o.rowNumber,
            sourceRow: o.sourceRow,
            orderNumber: o.orderNumber,
            orderTypeId: o.orderTypeId,
            contractTypeId: o.contractTypeId,
            description: o.description,
            siafNumber: o.siafNumber,
            issueDate: o.issueDate,
            commitmentDate: o.commitmentDate,
            statusId: o.statusId,
            rawStatus: o.statusRaw,
            amount: o.amount,
            rawAmount: o.rawAmount,
            isCancelled: o.isCancelled,
            ruc: o.ruc as string,
            supplierId: idPorRuc.get(o.ruc as string) as string,
            managementPeriodId: o.managementPeriodId,
            rawData: o.rawData,
            dedupeKey: o.dedupeKey ?? '',
          }));

        // Una versión es una instantánea completa: nunca se descartan filas contra
        // versiones anteriores (perderíamos cambios de estado y filas sin cambios).
        const filasAInsertar = filas;
        ordenesInsertadas = filas.length;
        ordenesOmitidasPorDuplicado = 0;
        if (filas.length > 0) await tx.order.createMany({ data: filas });
        await tx.importBatch.update({
          where: { id: lote.id },
          data: {
            isCurrent: true, requiresReview: false,
            sourceUrl: input.sourceUrl === undefined ? lote.sourceUrl : input.sourceUrl || null,
            coverageComplete: input.coverageComplete ?? lote.coverageComplete,
            status: validacion.summary.warningRows > 0 ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED',
            totalRows: validacion.summary.totalRows, successfulRows: filas.length,
            warningRows: validacion.summary.warningRows, errorRows: validacion.summary.errorRows,
            excludedRows: ordenesExcluidasPorDecision, processingFinishedAt: new Date(),
          },
        });

        // 3. Resúmenes por (proveedor, gestión).
        const combinaciones = new Map<string, { supplierId: string; managementPeriodId: string }>();
        for (const orden of validacion.orders) {
          if (!orden.ruc || !orden.managementPeriodId) continue;
          const supplierId = idPorRuc.get(orden.ruc);
          if (!supplierId) continue;
          combinaciones.set(`${supplierId}|${orden.managementPeriodId}`, {
            supplierId,
            managementPeriodId: orden.managementPeriodId,
          });
        }

        for (const par of paresAnteriores) {
          if (par.managementPeriodId) combinaciones.set(`${par.supplierId}|${par.managementPeriodId}`, {
            supplierId: par.supplierId, managementPeriodId: par.managementPeriodId,
          });
        }
        for (const combo of combinaciones.values()) {
          await recalcularResumenGestion(tx, combo.supplierId, combo.managementPeriodId);
        }

        // 4. Auditoría, dentro de la misma transacción.
        await registrarAuditoria(tx, {
          userId,
          action: 'IMPORT',
          entity: 'ImportBatch',
          entityId: lote.id,
          ip,
          userAgent,
          metadata: {
            period: lote.period,
            version: lote.version,
            originalFilename: lote.originalFilename,
            checksum: lote.checksum,
            totalRows: validacion.summary.totalRows,
            insertedOrders: filasAInsertar.length,
            skippedDuplicates: 0,
            supersededBatches: idsAnteriores,
            excludedByAdmin: ordenesExcluidasPorDecision,
            errorRows: validacion.summary.errorRows,
            warningRows: validacion.summary.warningRows,
            cancelledRows: validacion.summary.cancelledRows,
            registeredCents: validacion.summary.registeredCents,
            consideredCents: validacion.summary.consideredCents,
            suppliersCreated: proveedoresCreados,
            supplierVariants: variantesDetectadas,
          },
        });
      },
      { timeout: 120_000, maxWait: 15_000 },
    );

    const huboAdvertencias = validacion.summary.warningRows > 0;
    const estadoFinal = huboAdvertencias ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED';



    return {
      importBatchId: lote.id,
      status: estadoFinal,
      ordenesInsertadas,
      ordenesOmitidasPorDuplicado,
      ordenesExcluidasPorDecision,
      proveedoresCreados,
      proveedoresExistentes,
      variantesDetectadas,
      summary: validacion.summary,
    };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);

    await prisma.importBatch.update({
      where: { id: lote.id },
      data: {
        status: 'FAILED',
        errorMessage: mensaje.slice(0, 2000),
        processingFinishedAt: new Date(),
      },
    });

    throw error;
  }
}

export type EliminarImportacionInput = {
  importBatchId: string;
  userId: string | null;
  request?: Request;
  /**
   * Borra además los proveedores que se queden sin ninguna orden ni vínculo.
   * Activado por defecto: sin esto, «vaciar» dejaría el listado de proveedores
   * lleno de fichas en cero.
   */
  borrarProveedoresHuerfanos?: boolean;
};

export type EliminarImportacionResult = {
  importBatchId: string;
  period: string;
  version: number;
  ordenesEliminadas: number;
  proveedoresEliminados: number;
  /** Proveedores que se quedaron sin órdenes pero se conservan: tienen otras órdenes, vínculos declarados o fotografía. */
  proveedoresConservados: number;
  archivoEliminado: boolean;
};

/**
 * Elimina una importación completa: sus órdenes, sus columnas, sus hallazgos, su
 * archivo original y, si se pide, los proveedores que se queden huérfanos.
 *
 * Es la única operación del portal que borra datos de verdad, así que hace tres
 * cosas que no se pueden saltar:
 *
 *  1. Rehace los resúmenes por (proveedor, gestión) que alimentaba el lote. Las
 *     órdenes se van por cascada, pero `SupplierManagementSummary` NO: sin esto, el
 *     portal seguiría contando órdenes que ya no existen.
 *  2. Deja la eliminación en la auditoría, con sus cifras. El rastro sobrevive al
 *     lote porque la auditoría guarda el identificador como texto, sin clave foránea.
 *  3. Borra el archivo original del almacenamiento.
 *
 * Un lote en proceso no se puede eliminar: se está escribiendo en ese momento.
 */
export async function eliminarImportacion(
  input: EliminarImportacionInput,
): Promise<EliminarImportacionResult> {
  const { importBatchId, userId, request, borrarProveedoresHuerfanos = true } = input;

  const lote = await prisma.importBatch.findUnique({
    where: { id: importBatchId },
    select: {
      id: true,
      period: true,
      version: true,
      status: true,
      originalFilename: true,
      checksum: true,
      storageKey: true,
      processingStartedAt: true,
    },
  });

  if (!lote) throw new NoEncontrado(`No existe el lote de importación ${importBatchId}.`);

  // Un lote en proceso no se toca: se está escribiendo en ese momento. Pero uno que
  // lleva colgado más de lo razonable sí se puede borrar, o quedaría atascado para
  // siempre. La recuperación queda anotada en la auditoría del borrado.
  const estabaColgado =
    lote.status === 'PROCESSING' && procesoCaducado(lote.processingStartedAt, new Date());

  if (lote.status === 'PROCESSING' && !estabaColgado) {
    throw new ErrorDeNegocio(
      'Esa importación se está procesando ahora mismo. Espera a que termine antes de eliminarla.',
    );
  }

  const { ip, userAgent } = request
    ? contextoDePeticion(request)
    : { ip: null, userAgent: null };

  let ordenesEliminadas = 0;
  let proveedoresEliminados = 0;
  let proveedoresConservados = 0;

  await prisma.$transaction(
    async (tx) => {
      // Parejas (proveedor, gestión) que este lote alimentaba: son las que hay que
      // limpiar o rehacer cuando sus órdenes desaparezcan.
      const afectadas = (
        await tx.order.findMany({
          where: { importBatchId: lote.id },
          select: { supplierId: true, managementPeriodId: true },
          distinct: ['supplierId', 'managementPeriodId'],
        })
      ).filter(
        (par): par is { supplierId: string; managementPeriodId: string } =>
          par.managementPeriodId !== null,
      );

      const proveedoresDelLote = (
        await tx.order.findMany({
          where: { importBatchId: lote.id },
          select: { supplierId: true },
          distinct: ['supplierId'],
        })
      ).map((fila) => fila.supplierId);

      ordenesEliminadas = await tx.order.count({ where: { importBatchId: lote.id } });

      // El lote se lleva sus órdenes, sus columnas y sus hallazgos por cascada.
      await tx.importBatch.delete({ where: { id: lote.id } });

      // Resúmenes: se borra el de los pares que se quedan sin órdenes y se rehace el
      // de los que todavía tienen alguna (por ejemplo, de otra importación).
      const restantes = new Map<string, number>();

      if (proveedoresDelLote.length > 0) {
        const filas = await tx.order.groupBy({
          by: ['supplierId', 'managementPeriodId'],
          where: { supplierId: { in: proveedoresDelLote }, managementPeriodId: { not: null } },
          _count: { _all: true },
        });

        for (const fila of filas) {
          if (fila.managementPeriodId) {
            restantes.set(`${fila.supplierId}|${fila.managementPeriodId}`, fila._count._all);
          }
        }
      }

      const sinOrdenes = afectadas.filter(
        (par) => (restantes.get(`${par.supplierId}|${par.managementPeriodId}`) ?? 0) === 0,
      );

      if (sinOrdenes.length > 0) {
        await tx.supplierManagementSummary.deleteMany({
          where: {
            OR: sinOrdenes.map((par) => ({
              supplierId: par.supplierId,
              managementPeriodId: par.managementPeriodId,
            })),
          },
        });
      }

      for (const par of afectadas) {
        if ((restantes.get(`${par.supplierId}|${par.managementPeriodId}`) ?? 0) > 0) {
          await recalcularResumenGestion(tx, par.supplierId, par.managementPeriodId);
        }
      }

      // Proveedores que se quedaron sin nada que los justifique. Se consultan las tres
      // referencias de una vez en lugar de proveedor a proveedor.
      let huerfanos: string[] = [];

      if (borrarProveedoresHuerfanos && proveedoresDelLote.length > 0) {
        const [conOrdenes, conVinculos, conFotos] = await Promise.all([
          tx.order.groupBy({
            by: ['supplierId'],
            where: { supplierId: { in: proveedoresDelLote } },
            _count: { _all: true },
          }),
          tx.personSupplierLink.groupBy({
            by: ['supplierId'],
            where: { supplierId: { in: proveedoresDelLote } },
            _count: { _all: true },
          }),
          tx.supplierPhoto.groupBy({
            by: ['supplierId'],
            where: { supplierId: { in: proveedoresDelLote } },
            _count: { _all: true },
          }),
        ]);

        const vivos = new Set<string>([
          ...conOrdenes.map((fila) => fila.supplierId),
          ...conVinculos.map((fila) => fila.supplierId),
          ...conFotos.map((fila) => fila.supplierId),
        ]);

        huerfanos = proveedoresDelLote.filter((id) => !vivos.has(id));
      }

      if (huerfanos.length > 0) {
        await tx.supplier.deleteMany({ where: { id: { in: huerfanos } } });
        proveedoresEliminados = huerfanos.length;
      }

      proveedoresConservados = proveedoresDelLote.length - proveedoresEliminados;

      // La eliminación también deja rastro.
      await registrarAuditoria(tx, {
        userId,
        action: 'DELETE',
        entity: 'ImportBatch',
        entityId: lote.id,
        ip,
        userAgent,
        metadata: {
          period: lote.period,
          version: lote.version,
          originalFilename: lote.originalFilename,
          checksum: lote.checksum,
          deletedOrders: ordenesEliminadas,
          deletedSuppliers: proveedoresEliminados,
          keptSuppliers: proveedoresConservados,
          recuperadoDeProcesoColgado: estabaColgado,
        },
      });
    },
    { timeout: 120_000, maxWait: 15_000 },
  );

  // El archivo original ya no hace falta. Si no se puede borrar, la base ya está
  // limpia: se avisa, pero no se tumba una operación que ya terminó bien.
  let archivoEliminado = false;

  if (lote.storageKey) {
    try {
      await getStorage().remove(lote.storageKey);
      archivoEliminado = true;
    } catch (error) {
      console.error('No se pudo borrar el archivo original de la importación:', error);
    }
  }

  return {
    importBatchId: lote.id,
    period: lote.period,
    version: lote.version,
    ordenesEliminadas,
    proveedoresEliminados,
    proveedoresConservados,
    archivoEliminado,
  };
}
