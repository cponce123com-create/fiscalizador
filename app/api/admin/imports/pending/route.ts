import { ErrorDeNegocio } from '@/lib/errors';
import { okJson, respuestaDeError } from '@/lib/api/responses';
import { requierePermiso } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { PROCESO_CADUCADO_MS } from '@/lib/import-process';
import { asegurarMunicipalidadActiva } from '@/services/municipalityService';

export const runtime = 'nodejs';

/** Analyses that have a server-stored original but are not yet published. */
export async function GET(request: Request): Promise<Response> {
  try {
    await requierePermiso('imports:write');
    const requestedId = new URL(request.url).searchParams.get('municipalityId');
    if (!requestedId) throw new ErrorDeNegocio('Selecciona la municipalidad para recuperar sus análisis pendientes.');
    const municipalityId = await asegurarMunicipalidadActiva(requestedId);
    const lotes = await prisma.importBatch.findMany({
      where: {
        municipalityId,
        storageKey: { not: null },
        OR: [
          { status: { in: ['VALIDATING', 'FAILED'] } },
          { status: 'PROCESSING', processingStartedAt: { lt: new Date(Date.now() - PROCESO_CADUCADO_MS - 1) } },
        ],
      },
      orderBy: { uploadedAt: 'asc' },
      take: 200,
      select: {
        id: true, originalFilename: true, period: true, year: true, month: true,
        importType: true, version: true, uploadedAt: true, sourceUrl: true,
        coverageComplete: true, errorMessage: true,
      },
    });
    const response = okJson({ lotes });
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (error) {
    return respuestaDeError(error);
  }
}
