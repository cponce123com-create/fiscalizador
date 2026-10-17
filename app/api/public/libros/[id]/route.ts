import { peticionPublicaLimitada } from '@/lib/public-request-limit';
import { prisma } from '@/lib/prisma';
import { camposOcultos, celdaCsv, celdaMontoCsv } from '@/lib/public-evidence';
import { cabeceraDescarga, extractoExcelDesdePaginas, nombreDescargaLibro } from '@/lib/book-download';
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
      municipalityId: true,
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
  const seleccion = {
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
    } as const;
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
  const valoresDe = (o: {
    id: string; orderNumber: string; sourceRow: number | null; issueDate: Date | null;
    description: string | null; ruc: string; amount: { toString(): string } | null;
    isCancelled: boolean; supplier: { name: string }; orderType: { label: string } | null;
    status: { label: string; countsEconomically: boolean } | null;
  }): Record<string, unknown> => ({
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
    });
  const lineaCsv = (valores: Record<string, unknown>) => campos.map((c) => c === 'amount' ? celdaMontoCsv(valores[c] == null ? null : String(valores[c])) : celdaCsv(valores[c])).join(',');
  const config = await leerConfiguracionPortal(batch.municipalityId);
  const excel = new URL(request.url).searchParams.get('formato') === 'xlsx';
  if (excel) {
    async function* leerPaginasXlsx() {
      let cursor: string | undefined;
      while (true) {
        const filas = await prisma.order.findMany({
          where: { importBatchId: id },
          orderBy: [{ sourceRow: 'asc' }, { id: 'asc' }],
          select: seleccion,
          take: 500,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (!filas.length) return;
        cursor = filas.at(-1)?.id;
        yield filas.map(valoresDe);
        if (filas.length < 500) return;
      }
    }
    const xlsx = await extractoExcelDesdePaginas(campos, leerPaginasXlsx(), total);
    return new Response(Buffer.from(xlsx), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': cabeceraDescarga(nombreDescargaLibro(batch, config.municipio, 'xlsx', true)),
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  // El CSV se lee en páginas y se envía progresivamente. Así una exportación de
  // 20.000 filas no mantiene simultáneamente objetos Prisma, registros clonados
  // y una cadena completa en la memoria limitada de Render Free.
  const codificador = new TextEncoder();
  let cursor: string | undefined;
  let primeraPagina = true;
  const cuerpo = new ReadableStream<Uint8Array>({
    async pull(controlador) {
      try {
        const filas = await prisma.order.findMany({
          where: { importBatchId: id },
          orderBy: [{ sourceRow: 'asc' }, { id: 'asc' }],
          select: seleccion,
          take: 500,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (primeraPagina) {
          controlador.enqueue(codificador.encode(`\uFEFF${campos.map(celdaCsv).join(',')}\r\n`));
          primeraPagina = false;
        }
        if (!filas.length) {
          controlador.close();
          return;
        }
        cursor = filas.at(-1)?.id;
        controlador.enqueue(codificador.encode(`${filas.map(fila => lineaCsv(valoresDe(fila))).join('\r\n')}\r\n`));
        if (filas.length < 500) controlador.close();
      } catch (error) {
        controlador.error(error);
      }
    },
  });
  return new Response(cuerpo, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': cabeceraDescarga(nombreDescargaLibro(batch, config.municipio, 'csv', true)),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function GET(...args: Parameters<typeof atender>): Promise<Response> {
  return peticionPublicaLimitada('export', args[0], () => atender(...args));
}
