import { coincideProveedor } from '@/lib/busqueda-nombres-sql';
import { decimalMonetario } from '@/lib/decimal';
import { Prisma } from '@/lib/generated/prisma/client';
import type { ProveedorGlobal, ResultadoBusquedaGlobal } from '@/lib/busqueda-global';
import { prisma } from '@/lib/prisma';

type FilaGlobal = {
  supplierId: string;
  supplierName: string;
  ruc: string;
  supplierSlug: string;
  municipalityId: string;
  municipalitySlug: string;
  municipalityName: string;
  periodName: string | null;
  ordenes: number;
  considerado: string;
};

/** Busca proveedores en todos los libros vigentes, sin limitarse a la municipalidad seleccionada. */
export async function buscarProveedoresGlobal(texto: string): Promise<ResultadoBusquedaGlobal> {
  const termino = texto.trim().slice(0, 120);
  if (termino.length < 3) return { totalProveedores: 0, proveedores: [] };

  const [conteo, filas] = await Promise.all([
    prisma.$queryRaw<Array<{ n: number }>>`
      SELECT COUNT(DISTINCT s.id)::int AS n
      FROM "Supplier" s
      JOIN "CurrentOrder" o ON o."supplierId" = s.id
      JOIN "Municipality" m ON m.id = o."municipalityId" AND m."isActive" = true
      WHERE ${coincideProveedor(termino)}
    `,
    prisma.$queryRaw<FilaGlobal[]>`
      WITH proveedores AS (
        SELECT s.id
        FROM "Supplier" s
        JOIN "CurrentOrder" o ON o."supplierId" = s.id
        JOIN "Municipality" m ON m.id = o."municipalityId" AND m."isActive" = true
        WHERE ${coincideProveedor(termino)}
        GROUP BY s.id, s.name, s.ruc
        ORDER BY CASE WHEN lower(s.name) = lower(${termino}) OR s.ruc = ${termino} THEN 0 ELSE 1 END,
                 COUNT(o.id) DESC, s.name ASC
        LIMIT 8
      )
      SELECT s.id AS "supplierId", s.name AS "supplierName", s.ruc, s.slug AS "supplierSlug",
             m.id AS "municipalityId", m.slug AS "municipalitySlug", m."shortName" AS "municipalityName",
             g.name AS "periodName", COUNT(o.id)::int AS ordenes,
             COALESCE(SUM(o.amount) FILTER (
               WHERE o."isCancelled" = false AND st."countsEconomically" = true
             ), 0)::text AS considerado
      FROM proveedores p
      JOIN "Supplier" s ON s.id = p.id
      JOIN "CurrentOrder" o ON o."supplierId" = s.id
      JOIN "Municipality" m ON m.id = o."municipalityId" AND m."isActive" = true
      LEFT JOIN "ManagementPeriod" g ON g.id = o."managementPeriodId"
      LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
      GROUP BY s.id, s.name, s.ruc, s.slug, m.id, m.slug, m."shortName", g.id, g.name, g."startDate"
      ORDER BY s.name ASC, m."shortName" ASC, g."startDate" ASC NULLS LAST
    `,
  ]);

  const mapa = new Map<string, ProveedorGlobal>();
  for (const fila of filas) {
    let proveedor = mapa.get(fila.supplierId);
    if (!proveedor) {
      proveedor = { id: fila.supplierId, nombre: fila.supplierName, ruc: fila.ruc, slug: fila.supplierSlug, ordenes: 0, considerado: '0.00', municipalidades: [] };
      mapa.set(fila.supplierId, proveedor);
    }
    let municipalidad = proveedor.municipalidades.find(item => item.id === fila.municipalityId);
    if (!municipalidad) {
      municipalidad = { id: fila.municipalityId, slug: fila.municipalitySlug, nombre: fila.municipalityName, ordenes: 0, considerado: '0.00', periodos: [] };
      proveedor.municipalidades.push(municipalidad);
    }
    municipalidad.ordenes += Number(fila.ordenes);
    municipalidad.considerado = decimalMonetario(new Prisma.Decimal(municipalidad.considerado).plus(fila.considerado));
    if (fila.periodName && !municipalidad.periodos.includes(fila.periodName)) municipalidad.periodos.push(fila.periodName);
    proveedor.ordenes += Number(fila.ordenes);
    proveedor.considerado = decimalMonetario(new Prisma.Decimal(proveedor.considerado).plus(fila.considerado));
  }

  return { totalProveedores: conteo[0]?.n ?? 0, proveedores: [...mapa.values()] };
}
