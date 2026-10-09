import { ESTADOS_IMPORTADOS } from '@/lib/source-books';
import type { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { idMunicipalidadDesdeSlug } from '@/services/municipalityService';

export type FiltrosLibros = { year?: string; month?: string; tipo?: string; page?: string; municipalidad?: string };
export const LIBROS_POR_PAGINA = 12;
export async function listarFuentesLibros(params: FiltrosLibros) {
  const municipalityId = await idMunicipalidadDesdeSlug(params.municipalidad);
  const year = /^\d{4}$/.test(params.year ?? '') ? Number(params.year) : undefined;
  const month = /^(?:[1-9]|1[0-2])$/.test(params.month ?? '') ? Number(params.month) : undefined;
  const tipo = ['ORDENES_COMPRA', 'ORDENES_SERVICIO', 'CONSOLIDADO'].includes(params.tipo ?? '') ? params.tipo as 'ORDENES_COMPRA' | 'ORDENES_SERVICIO' | 'CONSOLIDADO' : undefined;
  const where: Prisma.ImportBatchWhereInput = { municipalityId, status: { in: ESTADOS_IMPORTADOS }, ...(year ? { year } : {}), ...(month ? { month } : {}), ...(tipo ? { importType: tipo } : {}) };
  // Solo libros confirmados: el análisis previo permanece privado.
  const [inventario, total] = await Promise.all([
    prisma.importBatch.findMany({ where: { municipalityId, status: { in: ESTADOS_IMPORTADOS } }, orderBy: [{ year: 'desc' }, { month: 'desc' }, { version: 'desc' }], select: { id: true, year: true, month: true, importType: true, status: true, isCurrent: true, requiresReview: true } }),
    prisma.importBatch.count({ where }),
  ]);
  const totalPaginas = Math.max(1, Math.ceil(total / LIBROS_POR_PAGINA));
  const numeroPagina = Number(params.page);
  const pagina = Math.min(totalPaginas, Number.isSafeInteger(numeroPagina) && numeroPagina > 0 ? numeroPagina : 1);
  const lotes = await prisma.importBatch.findMany({
    where, orderBy: [{ year: 'desc' }, { month: 'desc' }, { version: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    skip: (pagina - 1) * LIBROS_POR_PAGINA, take: LIBROS_POR_PAGINA,
    select: { id: true, year: true, month: true, importType: true, version: true, status: true, isCurrent: true, requiresReview: true, coverageComplete: true, sourceUrl: true, sheetName: true, checksum: true, originalFilename: true, uploadedAt: true, processingFinishedAt: true, totalRows: true, errorRows: true, excludedRows: true, warningRows: true, _count: { select: { orders: true } } },
  });
  return { inventario, lotes, total, pagina, totalPaginas, filtros: { year, month, tipo } };
}
