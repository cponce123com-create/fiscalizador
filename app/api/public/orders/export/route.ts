import { peticionPublicaLimitada } from '@/lib/public-request-limit';
import { prisma } from '@/lib/prisma';
import { leerFiltros } from '@/lib/filtros';
import { camposOcultos, celdaCsv, celdaMontoCsv } from '@/lib/public-evidence';
import { decimalMonetario } from '@/lib/decimal';
import { construirWhereOrdenes } from '@/services/statisticsService';

export const runtime = 'nodejs';

/** El mismo universo que el listado, sin paginar, en una instantánea consistente. */
async function atender(request: Request): Promise<Response> {
  const filtros = leerFiltros(Object.fromEntries(new URL(request.url).searchParams));
  const where = await construirWhereOrdenes(filtros);
  const datos = await prisma.$transaction(
    async (tx) => {
      if ((await tx.order.count({ where })) > 20000) return null;
      const [filas, registrado, considerado] = await Promise.all([
        tx.order.findMany({
          where,
          orderBy: [{ importBatchId: 'asc' }, { sourceRow: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            orderNumber: true,
            issueDate: true,
            description: true,
            ruc: true,
            amount: true,
            isCancelled: true,
            sourceRow: true,
            rawStatus: true,
            siafNumber: true,
            supplier: { select: { name: true } },
            orderType: { select: { label: true } },
            status: { select: { label: true, countsEconomically: true } },
            importBatch: {
              select: {
                id: true,
                year: true,
                month: true,
                version: true,
                sheetName: true,
                checksum: true,
              },
            },
          },
        }),
        tx.order.aggregate({ where, _sum: { amount: true } }),
        tx.order.aggregate({
          where: { AND: [where, { isCancelled: false, status: { countsEconomically: true } }] },
          _sum: { amount: true },
        }),
      ]);
      return { filas, registrado: registrado._sum.amount, considerado: considerado._sum.amount };
    },
    { isolationLevel: 'RepeatableRead', timeout: 30000 },
  );
  if (!datos)
    return new Response(
      'El resultado supera 20.000 filas. Acota el periodo o proveedor antes de descargar.',
      { status: 413 },
    );
  const ocultos = await camposOcultos([...new Set(datos.filas.map((o) => o.importBatch.id))]);
  const campos = [
    'id',
    'importBatchId',
    'periodo',
    'version',
    'orderNumber',
    'orderType',
    'issueDate',
    'supplierName',
    'ruc',
    'description',
    'siafNumber',
    'amount',
    'status',
    'sourceRow',
    'sheetName',
    'checksum',
    'considerada',
    'capturedAt',
    'criterio',
  ].filter((c) => !ocultos.has(c));
  const capturedAt = new Date().toISOString();
  const criterio = JSON.stringify({ ...filtros, pagina: undefined, porPagina: undefined });
  const lineas = [campos.map(celdaCsv).join(',')];
  for (const o of datos.filas) {
    const b = o.importBatch;
    const valores: Record<string, unknown> = {
      id: o.id,
      importBatchId: b.id,
      periodo: `${b.year}-${String(b.month).padStart(2, '0')}`,
      version: b.version,
      orderNumber: o.orderNumber,
      orderType: o.orderType?.label,
      issueDate: o.issueDate?.toISOString().slice(0, 10),
      supplierName: o.supplier.name,
      ruc: o.ruc,
      description: o.description,
      siafNumber: o.siafNumber,
      amount: o.amount?.toFixed(2),
      status: o.status?.label ?? o.rawStatus,
      sourceRow: b.sheetName ? o.sourceRow : 'pendiente de revalidar',
      sheetName: b.sheetName,
      checksum: b.checksum,
      considerada: !o.isCancelled && o.status?.countsEconomically === true,
      capturedAt,
      criterio,
    };
    lineas.push(campos.map((c) => c === 'amount' ? celdaMontoCsv(valores[c] == null ? null : String(valores[c])) : celdaCsv(valores[c])).join(','));
  }
  const headers: Record<string, string> = {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="ordenes-filtradas.csv"',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Total-Ordenes': String(datos.filas.length),
    'X-Captured-At': capturedAt,
    'X-Fields-Omitted': String(ocultos.size > 0),
  };
  if (!ocultos.has('amount')) {
    headers['X-Total-Registrado'] = decimalMonetario(datos.registrado);
    headers['X-Total-Considerado'] = decimalMonetario(datos.considerado);
  }
  return new Response('\uFEFF' + lineas.join('\r\n'), { headers });
}

export async function GET(...args: Parameters<typeof atender>): Promise<Response> {
  return peticionPublicaLimitada('export', () => atender(...args));
}
