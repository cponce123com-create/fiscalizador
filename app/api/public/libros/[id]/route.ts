import { peticionPublicaLimitada } from '@/lib/public-request-limit';
import { prisma } from '@/lib/prisma';
import { camposOcultos, celdaCsv, celdaMontoCsv } from '@/lib/public-evidence';
import { cabeceraDescarga, extractoExcel, nombreDescargaLibro } from '@/lib/book-download';
import { leerConfiguracionPortal } from '@/services/portalService';
export const runtime = 'nodejs';
async function atender(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const batch = await prisma.importBatch.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      sheetName: true,
      checksum: true,
      isCurrent: true,
      year: true,
      month: true,
      version: true,
      importType: true,
    },
  });
  if (!batch || !['COMPLETED', 'COMPLETED_WITH_WARNINGS'].includes(batch.status))
    return new Response('Libro no disponible', { status: 404 });
  const [ocultos, total] = await Promise.all([
    camposOcultos(id),
    prisma.order.count({ where: { importBatchId: id } }),
  ]);
  if (total > 20000)
    return new Response('El libro supera el límite de exportación pública (20.000 filas).', {
      status: 413,
    });
  const filas = await prisma.order.findMany({
    where: { importBatchId: id },
    orderBy: [{ sourceRow: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      orderNumber: true,
      sourceRow: true,
      issueDate: true,
      description: true,
      ruc: true,
      amount: true,
      isCancelled: true,
      supplier: { select: { name: true } },
      orderType: { select: { label: true } },
      status: { select: { label: true, countsEconomically: true } },
    },
  });
  const campos = [
    'id',
    'importBatchId',
    'periodo',
    'importType',
    'version',
    'orderNumber',
    'orderType',
    'issueDate',
    'supplierName',
    'ruc',
    'description',
    'amount',
    'status',
    'sourceRow',
    'sheetName',
    'checksum',
    'isCurrent',
    'considerada',
  ].filter((c) => !ocultos.has(c));
  const lineas = [campos.map(celdaCsv).join(',')];
  const registros: Record<string, unknown>[] = [];
  for (const o of filas) {
    const valores: Record<string, unknown> = {
      id: o.id,
      importBatchId: batch.id,
      periodo: `${batch.year}-${String(batch.month).padStart(2, '0')}`,
      importType: batch.importType,
      version: batch.version,
      orderNumber: o.orderNumber,
      orderType: o.orderType?.label,
      issueDate: o.issueDate?.toISOString().slice(0, 10),
      supplierName: o.supplier.name,
      ruc: o.ruc,
      description: o.description,
      amount: o.amount?.toString(),
      status: o.status?.label,
      sourceRow: batch.sheetName ? o.sourceRow : 'pendiente de revalidar',
      sheetName: batch.sheetName,
      checksum: batch.checksum,
      isCurrent: batch.isCurrent,
      considerada: !o.isCancelled && o.status?.countsEconomically === true,
    };
    lineas.push(campos.map((c) => c === 'amount' ? celdaMontoCsv(valores[c] == null ? null : String(valores[c])) : celdaCsv(valores[c])).join(','));
    registros.push(valores);
  }
  const config = await leerConfiguracionPortal();
  const excel = new URL(request.url).searchParams.get('formato') === 'xlsx';
  if (excel) return new Response(Buffer.from(extractoExcel(campos, registros)), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': cabeceraDescarga(nombreDescargaLibro(batch, config.municipio, 'xlsx', true)),
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    },
  });
  return new Response('\uFEFF' + lineas.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': cabeceraDescarga(nombreDescargaLibro(batch, config.municipio, 'csv', true)),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function GET(...args: Parameters<typeof atender>): Promise<Response> {
  return peticionPublicaLimitada('export', () => atender(...args));
}
