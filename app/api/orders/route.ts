import { z } from 'zod';

import { ErrorDeNegocio, okJson, respuestaDeError } from '@/lib/api/responses';
import { requierePermiso } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/lib/generated/prisma/client';

/**
 * Consulta de órdenes, paginada y ordenada EN EL SERVIDOR.
 *
 * Regla del pliego (secciones 22 y 23): nunca se envían todas las filas al
 * navegador para paginar o sumar allí. Un portal de transparencia puede acabar
 * con cientos de miles de órdenes, y cargarlas todas rompería el navegador
 * además de exponer datos que el usuario no pidió.
 */

export const runtime = 'nodejs';

const TAMANO_PAGINA_POR_DEFECTO = 25;
const TAMANO_PAGINA_MAXIMO = 100;

const paramsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(TAMANO_PAGINA_MAXIMO).default(TAMANO_PAGINA_POR_DEFECTO),
  /** Búsqueda por número de orden, razón social o RUC. */
  q: z.string().trim().max(100).optional(),
  statusId: z.string().optional(),
  managementPeriodId: z.string().optional(),
  soloAnuladas: z.enum(['true', 'false']).transform((valor) => valor === 'true').optional(),
  orderBy: z.enum(['issueDate', 'amount', 'orderNumber']).default('issueDate'),
  dir: z.enum(['asc', 'desc']).default('desc'),
});

export async function GET(request: Request): Promise<Response> {
  try {
    await requierePermiso('orders:read');

    const url = new URL(request.url);
    const parsed = paramsSchema.safeParse(Object.fromEntries(url.searchParams));

    if (!parsed.success) {
      throw new ErrorDeNegocio('Parámetros de consulta inválidos.');
    }

    const { page, pageSize, q, statusId, managementPeriodId, soloAnuladas, orderBy, dir } =
      parsed.data;

    const where: Prisma.OrderWhereInput = {};

    if (statusId) where.statusId = statusId;
    if (managementPeriodId) where.managementPeriodId = managementPeriodId;
    if (soloAnuladas) where.isCancelled = true;

    if (q) {
      // `contains` sobre el RUC es exacto; sobre el número de orden y la razón
      // social es parcial. Se usa OR para que una sola caja de búsqueda sirva.
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { ruc: { contains: q } },
        { supplier: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [ordenes, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { [orderBy]: dir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          orderNumber: true,
          description: true,
          issueDate: true,
          commitmentDate: true,
          amount: true,
          isCancelled: true,
          ruc: true,
          siafNumber: true,
          sourceRow: true,
          orderType: { select: { code: true, label: true } },
          status: { select: { code: true, label: true } },
          supplier: { select: { id: true, name: true, slug: true } },
          managementPeriod: { select: { name: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    // Los agregados se calculan en PostgreSQL, no sumando en el navegador.
    const agregados = await prisma.order.aggregate({
      where,
      _sum: { amount: true },
    });

    return okJson({
      ordenes,
      total,
      pagina: page,
      tamanoPagina: pageSize,
      totalPaginas: Math.max(1, Math.ceil(total / pageSize)),
      sumaRegistrada: agregados._sum.amount?.toFixed(2) ?? '0.00',
    });
  } catch (error) {
    return respuestaDeError(error);
  }
}
