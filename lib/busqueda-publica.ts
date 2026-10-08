export type ResultadoBusquedaPublica = {
  total: number;
  filas: { id: string; numero: string; proveedor: string; descripcion: string | null }[];
  totalProveedores: number;
  proveedores: { id: string; nombre: string; ruc: string; slug: string; ordenes: number }[];
};

export function busquedaPublicaVacia(): ResultadoBusquedaPublica {
  return { total: 0, filas: [], totalProveedores: 0, proveedores: [] };
}
