import { prisma } from '@/lib/prisma';
import { ErrorDeNegocio, NoEncontrado } from '@/lib/errors';
import { contextoDePeticion, registrarAuditoria, type ClienteDb } from '@/services/auditService';
import {
  camposObligatoriosFaltantes,
  indicesPorCampo,
  mapColumns,
  type ColumnMapping,
  type InternalField,
} from '@/services/mappingService';
import { computeChecksum, parseSpreadsheet, type RawSheet } from '@/services/parseService';
import { getStorage } from '@/services/storageService';
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
  proveedoresCreados: number;
  proveedoresExistentes: number;
  variantesDetectadas: number;
  summary: ValidationSummary;
};

const LIMITE_PREVIEW = 10;

/** Periodo en formato `YYYY-MM`. */
export function periodoDe(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
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
 */
function procesarBuffer(
  buffer: Buffer,
  catalogos: Catalogos,
  mappingOverride?: { position: number; field: InternalField | null; isPublic: boolean }[],
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
    indices,
    headerRowIndex: hoja.headerRowIndex,
    statuses: catalogos.statuses,
    orderTypes: catalogos.orderTypes,
    contractTypes: catalogos.contractTypes,
    managementPeriods: catalogos.managementPeriods,
  });

  return { hoja, mappings: mappingsFinales, validacion };
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

  // Duplicados: mismo contenido exacto, o mismo periodo ya importado.
  const [loteMismoChecksum, lotesMismoPeriodo, ultimaVersion] = await Promise.all([
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
    prisma.importBatch.findFirst({
      where: { year, month, importType },
      orderBy: { version: 'desc' },
      select: { version: true },
    }),
  ]);

  const version = (ultimaVersion?.version ?? 0) + 1;

  // El archivo original se guarda SIEMPRE, antes de cualquier decisión.
  const almacenado = await getStorage().save({
    buffer,
    filename: originalFilename,
    checksum,
  });

  // Gestión: si todas las filas caen en la misma, se deja fijada en el lote.
  const gestiones = new Set(
    validacion.orders.map((o) => o.managementPeriodId).filter((v): v is string => v !== null),
  );
  const managementPeriodId = gestiones.size === 1 ? [...gestiones][0]! : null;

  const lote = await prisma.importBatch.create({
    data: {
      filename: almacenado.key,
      originalFilename,
      year,
      month,
      period: periodo,
      importType,
      version,
      checksum,
      status: 'VALIDATING',
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
    },
    select: { id: true },
  });

  return {
    importBatchId: lote.id,
    checksum,
    sheetName: hoja.sheetName,
    sheetNames: hoja.sheetNames,
    headerRowIndex: hoja.headerRowIndex,
    version,
    columns: mappings,
    camposFaltantes,
    preview: validacion.orders.slice(0, LIMITE_PREVIEW).map(aPreview),
    summary: validacion.summary,
    issues: validacion.issues,
    lotesMismoPeriodo,
    loteMismoChecksum,
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
};

/**
 * FASE 2 — confirmar.
 *
 * Vuelve a leer el archivo guardado en el servidor y escribe todo en una única
 * transacción. Si cualquier paso falla, no queda nada a medias.
 */
export async function confirmar(input: ConfirmarInput): Promise<ConfirmarResult> {
  const { importBatchId, userId, request, mappingOverride, reemplazarPeriodo } = input;

  const lote = await prisma.importBatch.findUnique({ where: { id: importBatchId } });
  if (!lote) throw new NoEncontrado(`No existe el lote de importación ${importBatchId}.`);

  if (lote.status === 'PROCESSING') {
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

  await prisma.importBatch.update({
    where: { id: lote.id },
    data: { status: 'PROCESSING', processingStartedAt: new Date(), errorMessage: null },
  });

  try {
    const catalogos = await cargarCatalogos();
    const buffer = await getStorage().read(lote.storageKey);
    const { validacion } = procesarBuffer(buffer, catalogos, mappingOverride);

    const { ip, userAgent } = request
      ? contextoDePeticion(request)
      : { ip: null, userAgent: null };

    let proveedoresCreados = 0;
    let proveedoresExistentes = 0;
    let variantesDetectadas = 0;

    // El grueso del trabajo va en UNA transacción. El timeout se amplía porque
    // un libro grande puede tardar; en Render el límite de la petición es menor,
    // así que los libros muy grandes necesitarán el worker de una fase posterior.
    await prisma.$transaction(
      async (tx) => {
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

        if (filas.length > 0) {
          await tx.order.createMany({ data: filas });
        }

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
            insertedOrders: filas.length,
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

    await prisma.importBatch.update({
      where: { id: lote.id },
      data: {
        status: estadoFinal,
        totalRows: validacion.summary.totalRows,
        successfulRows: validacion.summary.successfulRows,
        warningRows: validacion.summary.warningRows,
        errorRows: validacion.summary.errorRows,
        processingFinishedAt: new Date(),
      },
    });

    return {
      importBatchId: lote.id,
      status: estadoFinal,
      ordenesInsertadas: validacion.orders.length,
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
