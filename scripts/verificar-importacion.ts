import 'dotenv/config';

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { prisma } from '../lib/prisma';
import { analizar, confirmar, periodoDe } from '../services/importService';
import { recalcularResumenGestion } from '../services/supplierService';

/**
 * Verificación de extremo a extremo del importador contra la base de datos real.
 *
 * Ejecuta las dos fases sobre el libro del Portal de Transparencia y comprueba
 * en PostgreSQL que las cifras coinciden con las de control del Paso 0.
 *
 * Uso:  npx tsx scripts/verificar-importacion.ts
 *
 * Es un script de verificación, no una prueba unitaria: toca la base de datos
 * real. Por eso vive en scripts/ y no en la suite de vitest.
 */

const RUTA_ARCHIVO = path.join(process.cwd(), 'docs', 'reference', 'Lista-OCOS-2023-06.xls');

// Cifras de control (docs/reference/FORMATOS.md).
const ESPERADO = {
  ordenes: 103,
  proveedores: 72,
  registrado: '1066136.59',
  anulado: '38994.87',
  considerado: '1027141.72',
  anuladas: 1,
};

let fallos = 0;

function comprobar(
  etiqueta: string,
  obtenido: string | number | boolean,
  esperado: string | number | boolean,
) {
  const ok = String(obtenido) === String(esperado);
  if (!ok) fallos++;
  console.log(`  ${ok ? 'OK  ' : 'FALLA'} ${etiqueta}: ${obtenido}${ok ? '' : ` (esperado ${esperado})`}`);
}

/**
 * Borra los datos de dominio para poder repetir la verificación desde cero.
 *
 * Solo se ejecuta con el argumento `--limpiar`: sin él, el script se niega a
 * tocar nada si ya hay datos. Es una salvaguarda deliberada, porque este script
 * apunta a la base de datos real.
 *
 * El orden importa: primero lo que depende de otras tablas.
 * Los registros de auditoría NO se borran: son el rastro de lo que ya ocurrió.
 */
async function limpiarDatosDeVerificacion(): Promise<void> {
  await prisma.order.deleteMany({});
  await prisma.supplierManagementSummary.deleteMany({});
  await prisma.importIssue.deleteMany({});
  await prisma.importColumn.deleteMany({});
  await prisma.supplierAlias.deleteMany({});
  await prisma.supplierPhoto.deleteMany({});
  await prisma.importBatch.deleteMany({});
  await prisma.supplier.deleteMany({});
}

async function main() {
  const quiereLimpiar = process.argv.includes('--limpiar');
  const ordenesExistentes = await prisma.order.count();

  if (quiereLimpiar) {
    console.log('Limpiando los datos de verificaciones anteriores…');
    await limpiarDatosDeVerificacion();
  } else if (ordenesExistentes > 0) {
    console.log(
      `La base ya contiene ${ordenesExistentes} orden(es). ` +
        'Vuelve a ejecutar con --limpiar para repetir la verificación desde cero.',
    );
    return;
  }

  const buffer = readFileSync(RUTA_ARCHIVO);

  console.log('');
  console.log('=== FASE 1: analizar (no debe escribir ninguna orden) ===');

  const antes = await prisma.order.count();

  const analisis = await analizar({
    buffer,
    originalFilename: 'Lista-OCOS-2023-06.xls',
    year: 2023,
    month: 6,
    importType: 'CONSOLIDADO',
    userId: null,
  });

  const despuesDeAnalizar = await prisma.order.count();
  comprobar('órdenes creadas durante el análisis', despuesDeAnalizar - antes, 0);

  console.log(`  lote            : ${analisis.importBatchId}`);
  console.log(`  hoja            : ${analisis.sheetName}`);
  console.log(`  version         : ${analisis.version}`);
  console.log(`  filas totales   : ${analisis.summary.totalRows}`);
  console.log(`  filas válidas   : ${analisis.summary.successfulRows}`);
  console.log(`  con advertencia : ${analisis.summary.warningRows}`);
  console.log(`  con error       : ${analisis.summary.errorRows}`);
  console.log(`  anuladas        : ${analisis.summary.cancelledRows}`);
  console.log(`  campos faltantes: ${analisis.camposFaltantes.length === 0 ? 'ninguno' : analisis.camposFaltantes.join(', ')}`);
  console.log(`  columnas mapeadas: ${analisis.columns.filter((c) => c.field).length} de ${analisis.columns.length}`);

  comprobar('filas válidas', analisis.summary.successfulRows, ESPERADO.ordenes);
  comprobar('errores', analisis.summary.errorRows, 0);
  comprobar('anuladas', analisis.summary.cancelledRows, ESPERADO.anuladas);
  comprobar('campos obligatorios faltantes', analisis.camposFaltantes.length, 0);

  const lote = await prisma.importBatch.findUnique({
    where: { id: analisis.importBatchId },
    select: { status: true, checksum: true, storageKey: true, columns: true, issues: true },
  });
  comprobar('estado del lote tras analizar', lote?.status ?? 'SIN LOTE', 'VALIDATING');
  comprobar('columnas persistidas', lote?.columns.length ?? 0, 12);
  console.log(`  hallazgos persistidos: ${lote?.issues.length ?? 0}`);

  console.log('');
  console.log('=== FASE 2: confirmar (transacción única) ===');

  const resultado = await confirmar({
    importBatchId: analisis.importBatchId,
    userId: null,
  });

  console.log(`  estado          : ${resultado.status}`);
  console.log(`  órdenes insertadas: ${resultado.ordenesInsertadas}`);
  console.log(`  proveedores creados: ${resultado.proveedoresCreados}`);
  console.log(`  variantes detectadas: ${resultado.variantesDetectadas}`);

  comprobar('órdenes insertadas', resultado.ordenesInsertadas, ESPERADO.ordenes);
  comprobar('proveedores creados', resultado.proveedoresCreados, ESPERADO.proveedores);

  console.log('');
  console.log('=== VERIFICACIÓN EN POSTGRESQL ===');

  const totalOrdenes = await prisma.order.count();
  comprobar('total de órdenes en la base', totalOrdenes, ESPERADO.ordenes);

  const proveedores = await prisma.supplier.count();
  comprobar('total de proveedores en la base', proveedores, ESPERADO.proveedores);

  const registrado = await prisma.order.aggregate({ _sum: { amount: true } });
  comprobar('suma registrada (Decimal)', registrado._sum.amount?.toFixed(2) ?? '0', ESPERADO.registrado);

  const anulado = await prisma.order.aggregate({
    where: { isCancelled: true },
    _sum: { amount: true },
    _count: { _all: true },
  });
  comprobar('suma anulada (Decimal)', anulado._sum.amount?.toFixed(2) ?? '0', ESPERADO.anulado);
  comprobar('órdenes anuladas', anulado._count._all, ESPERADO.anuladas);

  // La regla clave: el considerado excluye anuladas Y estados que no cuentan.
  const considerado = await prisma.order.aggregate({
    where: { isCancelled: false, status: { countsEconomically: true } },
    _sum: { amount: true },
  });
  comprobar(
    'monto considerado (Decimal)',
    considerado._sum.amount?.toFixed(2) ?? '0',
    ESPERADO.considerado,
  );

  const sumaResumenes = await prisma.supplierManagementSummary.aggregate({
    _sum: { consideredAmount: true },
    _count: { _all: true },
  });
  comprobar(
    'suma de resúmenes por gestión',
    sumaResumenes._sum.consideredAmount?.toFixed(2) ?? '0',
    ESPERADO.considerado,
  );
  console.log(`  resúmenes (proveedor, gestión): ${sumaResumenes._count._all}`);

  // El archivo original queda guardado y el checksum registrado.
  const loteFinal = await prisma.importBatch.findUnique({
    where: { id: analisis.importBatchId },
    select: {
      status: true,
      checksum: true,
      originalFileUrl: true,
      processingStartedAt: true,
      processingFinishedAt: true,
      managementPeriod: { select: { name: true } },
    },
  });
  comprobar('estado final del lote', loteFinal?.status ?? 'SIN LOTE', 'COMPLETED_WITH_WARNINGS');
  comprobar('checksum de 64 hex', /^[0-9a-f]{64}$/.test(loteFinal?.checksum ?? ''), 'true');
  comprobar('archivo original guardado', Boolean(loteFinal?.originalFileUrl), 'true');
  comprobar('gestión asignada al lote', loteFinal?.managementPeriod?.name ?? 'ninguna', '2023-2026');

  // Auditoría dentro de la misma transacción.
  const auditoria = await prisma.auditLog.findFirst({
    where: { entity: 'ImportBatch', entityId: analisis.importBatchId, action: 'IMPORT' },
  });
  comprobar('entrada de auditoría de la importación', Boolean(auditoria), 'true');
  if (auditoria) {
    const meta = auditoria.metadata as Record<string, unknown> | null;
    console.log(`  auditoría -> periodo ${meta?.['period']} v${meta?.['version']}, ${meta?.['insertedOrders']} órdenes`);
  }

  // El registro original se conserva íntegro.
  const muestra = await prisma.order.findFirst({
    where: { importBatchId: analisis.importBatchId },
    orderBy: { sourceRow: 'asc' },
    select: { rawData: true, rawAmount: true, amount: true, orderNumber: true },
  });
  const raw = muestra?.rawData as Record<string, unknown> | null;
  comprobar('rawData conserva el monto original', String(raw?.['Monto']), 'S/. 650');
  comprobar(
    'rawData conserva la fecha original',
    String(raw?.['Fecha de Emisión']),
    '2023-06-06 00:00:00.0',
  );
  comprobar('columnas del registro original', Object.keys(raw ?? {}).length, 12);

  // La orden anulada existe y está marcada, pero no suma.
  const anulada = await prisma.order.findFirst({
    where: { isCancelled: true },
    select: { orderNumber: true, amount: true, status: { select: { label: true } } },
  });
  comprobar('número de la orden anulada', anulada?.orderNumber ?? 'ninguna', '245');
  comprobar('monto de la orden anulada', anulada?.amount?.toFixed(2) ?? '0', '38994.87');
  comprobar('estado de la orden anulada', anulada?.status?.label ?? 'ninguno', 'Anulada');

  console.log('');
  console.log('=== PROVEEDORES Y GESTIONES ===');

  // Escenario obligatorio: un proveedor con muchas órdenes aparece UNA sola vez.
  // INVERSIONES URRUCHI S.A.C. es el proveedor con más órdenes del libro (13).
  const urruchi = await prisma.supplier.findFirst({
    where: { ruc: '20610345990' },
    select: {
      id: true,
      name: true,
      _count: { select: { orders: true } },
      summaries: {
        select: {
          orderCount: true,
          consideredAmount: true,
          managementPeriod: { select: { name: true } },
        },
      },
    },
  });

  comprobar('URRUCHI: aparece como una sola fila de proveedor', urruchi ? 1 : 0, 1);
  comprobar('URRUCHI: sus órdenes cuelgan de esa única fila', urruchi?._count.orders ?? 0, 13);
  comprobar('URRUCHI: un resumen por gestión', urruchi?.summaries.length ?? 0, 1);
  comprobar('URRUCHI: orderCount del resumen', urruchi?.summaries[0]?.orderCount ?? 0, 13);

  // El resumen materializado debe coincidir con la suma real de sus órdenes.
  const sumaRealUrruchi = await prisma.order.aggregate({
    where: { supplierId: urruchi?.id, isCancelled: false, status: { countsEconomically: true } },
    _sum: { amount: true },
  });
  comprobar(
    'URRUCHI: el resumen coincide con la suma real de sus órdenes',
    urruchi?.summaries[0]?.consideredAmount.toFixed(2) ?? '0',
    sumaRealUrruchi._sum.amount?.toFixed(2) ?? '0',
  );

  // No hay órdenes sin proveedor: el recuento de proveedores con órdenes debe
  // coincidir con el total de proveedores creados.
  const proveedoresConOrdenes = await prisma.order.groupBy({ by: ['supplierId'] });
  comprobar('proveedores distintos con órdenes', proveedoresConOrdenes.length, ESPERADO.proveedores);

  // Escenario obligatorio: el mismo proveedor en VARIAS gestiones debe quedar
  // agrupado por gestión, no en una sola fila.
  //
  // Se prueba dentro de una transacción que se REVIERTE a propósito, así la
  // comprobación es real pero no deja ninguna orden sintética en la base.
  const gestionAnterior = await prisma.managementPeriod.findUnique({
    where: { name: '2019-2022' },
  });

  if (urruchi && gestionAnterior) {
    const estadoDevengada = await prisma.orderStatus.findUnique({ where: { code: 'DEVENGADA' } });

    try {
      await prisma.$transaction(async (tx) => {
        await tx.order.create({
          data: {
            importBatchId: analisis.importBatchId,
            orderNumber: 'SINTETICA-REVERSION',
            ruc: '20610345990',
            supplierId: urruchi.id,
            amount: '1000.00',
            isCancelled: false,
            statusId: estadoDevengada?.id ?? null,
            managementPeriodId: gestionAnterior.id,
            issueDate: new Date(Date.UTC(2021, 5, 1)),
            rawData: { sintetico: true },
            dedupeKey: 'SINTETICA-REVERSION|20610345990|1000.00|2021-06-01',
          },
        });

        await recalcularResumenGestion(tx, urruchi.id, gestionAnterior.id);

        const resumenes = await tx.supplierManagementSummary.count({
          where: { supplierId: urruchi.id },
        });
        comprobar('el mismo proveedor en dos gestiones produce dos resúmenes', resumenes, 2);

        // Reversión deliberada de toda la transacción.
        throw new Error('REVERTIR_PRUEBA');
      });
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'REVERTIR_PRUEBA') throw error;
    }

    const resumenesTrasRevertir = await prisma.supplierManagementSummary.count({
      where: { supplierId: urruchi.id },
    });
    comprobar('la prueba se revirtió: vuelve a haber un solo resumen', resumenesTrasRevertir, 1);
    comprobar(
      'la prueba se revirtió: no quedó ninguna orden sintética',
      await prisma.order.count({ where: { orderNumber: 'SINTETICA-REVERSION' } }),
      0,
    );
  }

  console.log('');
  console.log('=== REIMPORTACIÓN DEL MISMO ARCHIVO (debe detenerse) ===');

  const segundo = await analizar({
    buffer,
    originalFilename: 'Lista-OCOS-2023-06.xls',
    year: 2023,
    month: 6,
    importType: 'CONSOLIDADO',
    userId: null,
  });

  comprobar('detecta el mismo checksum', Boolean(segundo.loteMismoChecksum), 'true');
  comprobar('asigna una versión nueva', segundo.version, 2);
  comprobar('detecta lotes previos del periodo', segundo.lotesMismoPeriodo.length, 1);

  let seDetuvo = false;
  let mensaje = '';
  try {
    await confirmar({ importBatchId: segundo.importBatchId, userId: null });
  } catch (error) {
    seDetuvo = true;
    mensaje = error instanceof Error ? error.message : String(error);
  }
  comprobar('se niega a reimportar sin confirmación explícita', seDetuvo, 'true');
  if (mensaje) console.log(`  mensaje: ${mensaje}`);

  const trasIntento = await prisma.order.count();
  comprobar('no se duplicaron órdenes', trasIntento, ESPERADO.ordenes);

  const loteFallido = await prisma.importBatch.findUnique({
    where: { id: segundo.importBatchId },
    select: { status: true },
  });
  console.log(`  estado del segundo lote: ${loteFallido?.status} (queda registrado, no se borra)`);

  console.log('');
  if (fallos === 0) {
    console.log('VERIFICACIÓN COMPLETA: todas las comprobaciones pasaron.');
  } else {
    console.log(`VERIFICACIÓN CON ${fallos} FALLO(S).`);
    process.exitCode = 1;
  }

  console.log(`periodo esperado: ${periodoDe(2023, 6)}`);
}

main()
  .catch((error) => {
    console.error('La verificación falló:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
