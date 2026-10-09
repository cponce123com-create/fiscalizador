import { leerFiltros } from '@/lib/filtros';
import { busquedaPublicaVacia, type ResultadoBusquedaPublica } from '@/lib/busqueda-publica';
import { listarOrdenes, listarProveedores } from '@/services/statisticsService';

/** Proyección pública limitada: no lee perfiles, familiares ni notas privadas. */
export async function buscarEnPortal(texto: string, municipalidad?: string | null): Promise<ResultadoBusquedaPublica> {
  const filtros = leerFiltros({ texto: texto.trim(), municipalidad: municipalidad ?? undefined, porPagina: '5' });
  if (!filtros.texto || filtros.texto.length < 3) return busquedaPublicaVacia();
  const [proveedores, ordenes] = await Promise.all([listarProveedores(filtros), listarOrdenes(filtros)]);
  return {
    totalProveedores: proveedores.total,
    proveedores: proveedores.filas.map(p => ({ id: p.id, nombre: p.nombre, ruc: p.ruc, slug: p.slug, ordenes: p.ordenes })),
    total: ordenes.total,
    filas: ordenes.filas.map(o => ({ id: o.id, numero: o.orderNumber, proveedor: o.proveedor, descripcion: o.description })),
  };
}
