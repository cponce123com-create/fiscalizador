import { okJson, respuestaDeError } from '@/lib/api/responses';
import { requierePermiso } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

/** Listado de importaciones, paginado en el servidor. */

export const runtime = 'nodejs';

const TAMANO_PAGINA = 20;

export async function GET(request: Request): Promise<Response> {
  try {
    await requierePermiso('imports:read');

    const url = new URL(request.url);
    const pagina = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);

    const [lotes, total] = await Promise.all([
      prisma.importBatch.findMany({
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { version: 'desc' }],
        skip: (pagina - 1) * TAMANO_PAGINA,
        take: TAMANO_PAGINA,
        select: {
          id: true,
          originalFilename: true,
          period: true,
          year: true,
          month: true,
          importType: true,
          version: true,
          status: true,
          totalRows: true,
          successfulRows: true,
          warningRows: true,
          errorRows: true,
          uploadedAt: true,
          processingFinishedAt: true,
          errorMessage: true,
          uploadedBy: { select: { email: true } },
          managementPeriod: { select: { name: true } },
          _count: { select: { orders: true, issues: true } },
        },
      }),
      prisma.importBatch.count(),
    ]);

    return okJson({
      lotes,
      total,
      pagina,
      tamanoPagina: TAMANO_PAGINA,
      totalPaginas: Math.max(1, Math.ceil(total / TAMANO_PAGINA)),
    });
  } catch (error) {
    return respuestaDeError(error);
  }
}
