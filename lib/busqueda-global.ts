export type ResultadoMunicipalProveedor = {
  id: string;
  slug: string;
  nombre: string;
  ordenes: number;
  considerado: string;
  periodos: string[];
};

export type ProveedorGlobal = {
  id: string;
  nombre: string;
  ruc: string;
  slug: string;
  ordenes: number;
  considerado: string;
  municipalidades: ResultadoMunicipalProveedor[];
};

export type ResultadoBusquedaGlobal = {
  totalProveedores: number;
  proveedores: ProveedorGlobal[];
};

export function busquedaGlobalVacia(): ResultadoBusquedaGlobal {
  return { totalProveedores: 0, proveedores: [] };
}
