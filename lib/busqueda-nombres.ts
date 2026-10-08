import type { Prisma } from '@/lib/generated/prisma/client';
import { palabrasBusqueda } from './busqueda-ordenes';

/** Todas las palabras deben coincidir en el mismo nombre, en cualquier orden. */
export function buscarNombre(texto: string) {
  const palabras = [...new Set(texto.trim().split(/\s+/).filter(Boolean))];
  return { AND: palabras.map(p => ({ fullName: { contains: p, mode: 'insensitive' as const } })) };
}

/** La clave normalizada también permite buscar proveedores sin tildes. */
export function buscarNombreProveedor(texto: string): Prisma.SupplierWhereInput {
  const palabras = palabrasBusqueda(texto);
  return { OR: [
    { AND: texto.trim().split(/\s+/).filter(Boolean).map(p => ({ name: { contains: p, mode: 'insensitive' } })) },
    ...(palabras.length ? [{ AND: palabras.map(p => ({ normalizedName: { contains: p, mode: 'insensitive' as const } })) }] : []),
  ] };
}
