import { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { decimalMonetario } from '@/lib/decimal';
import type { GastoAlimentacionGestion } from '@/lib/alimentacion';
import { categoriasGasto, type CategoriaGasto } from '@/lib/categorias-gasto';
import type { Filtros } from '@/lib/filtros';
import type { FilaOrdenListado, ResultadoPaginado } from './statisticsService';

// Normaliza la descripción de la vista: PostgreSQL fija las columnas de una vista
// al crearla, por lo que no se presupone que incluya columnas añadidas después.
const descripcion = Prisma.sql`' ' || trim(regexp_replace(translate(lower(coalesce(o.description, '')), 'áàäâéèëêíìïîóòöôúùüûñ', 'aaaaeeeeiiiioooouuuun'), '[^a-z0-9]+', ' ', 'g')) || ' '`;
function coincide(categoria: CategoriaGasto) {
  return Prisma.sql`${descripcion} ~ ${categoria.patrones[0]} AND ${descripcion} ~ ${categoria.patrones[1]} AND ${descripcion} !~ ${categoria.excluir}`;
}
export type GastoCategoriaGestion = GastoAlimentacionGestion & { categoria: string };

/** Las últimas tres gestiones iniciadas; los periodos futuros no desplazan la comparación. */
export async function gastosPorCategoriaGestion(): Promise<GastoCategoriaGestion[]> {
  const valores = Prisma.join(categoriasGasto.map(c => Prisma.sql`(${c.id}, ${c.patrones[0]}, ${c.patrones[1]}, ${c.excluir})`));
  const filas = await prisma.$queryRaw<GastoCategoriaGestion[]>`
    WITH categorias(categoria, patron1, patron2, excluir) AS (VALUES ${valores}), gestiones AS (
      SELECT id, name, "startDate" FROM "ManagementPeriod"
      WHERE "startDate" <= CURRENT_DATE ORDER BY "startDate" DESC, id LIMIT 3
    )
    SELECT c.categoria, g.id, g.name AS gestion,
      (SELECT COUNT(DISTINCT b.period)::int FROM "ImportBatch" b
        WHERE b."managementPeriodId" = g.id AND b."isCurrent" = true
        AND b.status IN ('COMPLETED', 'COMPLETED_WITH_WARNINGS')) AS meses,
      COUNT(o.id)::int AS ordenes,
      COUNT(o.id) FILTER (WHERE o."isCancelled" = true)::int AS anuladas,
      COALESCE(SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true), 0)::text AS considerado
    FROM gestiones g CROSS JOIN categorias c
    LEFT JOIN "CurrentOrder" o ON o."managementPeriodId" = g.id AND ${descripcion} ~ c.patron1 AND ${descripcion} ~ c.patron2 AND ${descripcion} !~ c.excluir
    LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
    GROUP BY c.categoria, g.id, g.name, g."startDate" ORDER BY c.categoria, g."startDate", g.id
  `;
  return filas.map(f => ({ ...f, considerado: decimalMonetario(f.considerado) }));
}

/** Mismo criterio que la tarjeta: permite auditar cada orden que forma la comparación. */
export async function listarOrdenesCategoria(categoria: CategoriaGasto, filtros: Filtros): Promise<ResultadoPaginado<FilaOrdenListado>> {
  const gestion = filtros.gestionId ?? '';
  const where = Prisma.sql`${coincide(categoria)} AND (${gestion} = '' OR o."managementPeriodId" = ${gestion})`;
  const conteo = await prisma.$queryRaw<Array<{ total: number }>>`SELECT COUNT(*)::int AS total FROM "CurrentOrder" o WHERE ${where}`;
  const total = conteo[0]?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / filtros.porPagina));
  const pagina = Math.min(filtros.pagina, totalPaginas);
  const filas = await prisma.$queryRaw<FilaOrdenListado[]>`
    SELECT o.id, o."orderNumber", o."issueDate", o.description, o.amount::text AS amount,
      o.ruc, o."isCancelled", t.code AS tipo, st.label AS estado, s.name AS proveedor, s.slug AS "proveedorSlug"
    FROM "CurrentOrder" o JOIN "Supplier" s ON s.id = o."supplierId"
    LEFT JOIN "OrderType" t ON t.id = o."orderTypeId"
    LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
    WHERE ${where} ORDER BY o."issueDate" DESC NULLS LAST, o.id
    LIMIT ${filtros.porPagina} OFFSET ${(pagina - 1) * filtros.porPagina}
  `;
  return { filas: filas.map(f => ({ ...f, amount: f.amount === null ? null : decimalMonetario(f.amount) })), total, pagina, porPagina: filtros.porPagina, totalPaginas };
}
