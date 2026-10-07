import { leerFiltros, serializarFiltros, type Filtros } from './filtros';

export const ESPERA_BUSQUEDA_PROVEEDORES = 350;

/** No consulta fragmentos cortos; al vaciar el texto se recupera el listado. */
export function destinoBusquedaProveedores(filtros: Filtros, texto: string, tipoRuc: string, ruta: '/proveedores' | '/admin/proveedores' = '/proveedores'): string | null {
  const termino = texto.trim();
  if (termino.length > 0 && termino.length < 3) return null;
  const validado = leerFiltros({ texto: termino, tipoRuc });
  if (termino && !validado.texto) return null;
  return `${ruta}${serializarFiltros(filtros, { texto: validado.texto, tipoRuc: validado.tipoRuc, pagina: 1 })}`;
}
