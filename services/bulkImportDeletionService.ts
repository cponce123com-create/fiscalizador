import { createHash } from 'node:crypto';
import { procesoCaducado } from '@/lib/import-process';
import { prisma } from '@/lib/prisma';
import { ErrorDeNegocio } from '@/lib/errors';
import { registrarAuditoria } from '@/services/auditService';
import { getStorage } from '@/services/storageService';

export const CONFIRMACION_BORRADO_MASIVO = 'ELIMINAR TODAS LAS IMPORTACIONES';
export function huellaImportaciones(lotes: { id: string; updatedAt: Date }[]): string {
  return createHash('sha256').update(JSON.stringify(lotes.map(l => [l.id, l.updatedAt.toISOString()]).sort((a, b) => a[0].localeCompare(b[0])))).digest('hex');
}
export async function resumenBorradoImportaciones() {
  const [lotes, ordenes] = await Promise.all([
    prisma.importBatch.findMany({ select: { id: true, updatedAt: true } }),
    prisma.order.count(),
  ]);
  return { lotes: lotes.length, ordenes, huella: huellaImportaciones(lotes) };
}
/** Borra un inventario confirmado en una sola transacción; conserva fichas manuales. */
export async function eliminarTodasImportaciones(input: { userId: string; confirmacion: string; huella: string }) {
  if (input.confirmacion.trim() !== CONFIRMACION_BORRADO_MASIVO) throw new ErrorDeNegocio(`Escribe ${CONFIRMACION_BORRADO_MASIVO} para confirmar.`);
  const resultado = await prisma.$transaction(async tx => {
    // Bloquea altas/cambios de lotes mientras comprobamos el inventario y lo vaciamos.
    await tx.$executeRaw`LOCK TABLE "ImportBatch" IN EXCLUSIVE MODE`;
    const lotes = await tx.importBatch.findMany({ select: { id: true, updatedAt: true, status: true, processingStartedAt: true, storageKey: true } });
    if (huellaImportaciones(lotes) !== input.huella) throw new ErrorDeNegocio('Las importaciones cambiaron. Recarga la página y revisa el inventario antes de eliminarlo.');
    if (lotes.some(l => l.status === 'PROCESSING' && !procesoCaducado(l.processingStartedAt, new Date()))) throw new ErrorDeNegocio('Hay importaciones procesándose. Espera a que terminen antes del borrado masivo.');
    if (!lotes.length) throw new ErrorDeNegocio('No hay importaciones que eliminar.');
    const ids = lotes.map(l => l.id);
    const ordenes = await tx.order.count({ where: { importBatchId: { in: ids } } });
    await tx.supplierManagementSummary.deleteMany({});
    await tx.appSetting.deleteMany({ where: { key: { in: ids.map(id => `libro-original-publico:${id}`) } } });
    await tx.importBatch.deleteMany({ where: { id: { in: ids } } });
    await registrarAuditoria(tx, { userId: input.userId, action: 'DELETE', entity: 'ImportBatch', metadata: { masivo: true, importBatchIds: ids, deletedBatches: ids.length, deletedOrders: ordenes, perfilesConservados: true } });
    return { lotes: ids.length, ordenes, claves: [...new Set(lotes.flatMap(l => l.storageKey ? [l.storageKey] : []))] };
  }, { timeout: 120_000, maxWait: 15_000 });
  let archivosPendientes = 0;
  for (const key of resultado.claves) {
    try {
      // Un archivo compartido por un lote nuevo no se elimina.
      if (!await prisma.importBatch.count({ where: { storageKey: key } })) await getStorage().remove(key);
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) archivosPendientes++;
    }
  }
  return { lotes: resultado.lotes, ordenes: resultado.ordenes, archivosPendientes };
}
