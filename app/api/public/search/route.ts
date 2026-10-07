import { peticionPublicaLimitada } from '@/lib/public-request-limit';
import { leerFiltros } from '@/lib/filtros';
import { listarOrdenes } from '@/services/statisticsService';

export const runtime = 'nodejs';

/** Solo campos del listado público; nunca fichas privadas de proveedores. */
async function atender(request: Request): Promise<Response> {
  const texto = new URL(request.url).searchParams.get('texto')?.trim() ?? '';
  const filtros = leerFiltros({ texto, porPagina: '5' });
  if (texto.length < 3 || !filtros.texto) return Response.json({ filas: [], total: 0 });
  try {
    const resultado = await listarOrdenes(filtros);
    return Response.json({ total: resultado.total, filas: resultado.filas.map(fila => ({ id: fila.id, numero: fila.orderNumber, proveedor: fila.proveedor, descripcion: fila.description })) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'No se pudo completar la búsqueda.' }, { status: 503 });
  }
}

export async function GET(...args: Parameters<typeof atender>): Promise<Response> {
  return peticionPublicaLimitada('search', () => atender(...args));
}
