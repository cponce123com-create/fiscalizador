import { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { coincideProveedor } from '@/lib/busqueda-nombres-sql';
import { categoriasGasto } from '@/lib/categorias-gasto';
import type { PlanIA, ResultadoIA } from '@/lib/ia';
import { decimalMonetario } from '@/lib/decimal';

/** Plantilla fija y parametrizada. Ningún SQL procede del modelo. */
export function filtrosIA(plan: PlanIA) {
  const condiciones = [Prisma.sql`m."isActive" = true AND o."isCancelled" = false AND st."countsEconomically" = true AND b."requiresReview" = false`];
  if (plan.proveedor) condiciones.push(coincideProveedor(plan.proveedor));
  if (plan.municipalidades.length) condiciones.push(Prisma.sql`m.slug IN (${Prisma.join(plan.municipalidades)})`);
  if (plan.desde) condiciones.push(Prisma.sql`o."issueDate" >= ${new Date(`${plan.desde}-01-01T00:00:00Z`)}`);
  if (plan.hasta) condiciones.push(Prisma.sql`o."issueDate" < ${new Date(`${plan.hasta + 1}-01-01T00:00:00Z`)}`);
  if (plan.categoria) {
    const categoria = categoriasGasto.find(c => c.id === plan.categoria);
    if (!categoria) throw new Error('IA_RESPUESTA');
    const descripcion = Prisma.sql`' ' || trim(regexp_replace(translate(lower(coalesce(o.description, '')), 'áàäâéèëêíìïîóòöôúùüûñ', 'aaaaeeeeiiiioooouuuun'), '[^a-z0-9]+', ' ', 'g')) || ' '`;
    condiciones.push(Prisma.sql`${descripcion} ~ ${categoria.patrones[0]} AND ${descripcion} ~ ${categoria.patrones[1]} AND ${descripcion} !~ ${categoria.excluir}`);
  }
  return Prisma.join(condiciones, ' AND ');
}
export async function consultarDatos(plan: PlanIA): Promise<ResultadoIA> {
  const where = filtrosIA(plan);
  const cte = Prisma.sql`WITH base AS MATERIALIZED (
    SELECT o.id, o."orderNumber", o.description, o.amount, s.id AS sid, s.name AS proveedor, s.slug,
      m.id AS mid, m.name AS municipalidad, m.slug AS "municipalidadSlug", COALESCE(g.name, 'Sin gestión asignada') AS gestion
    FROM "CurrentOrder" o JOIN "Supplier" s ON s.id = o."supplierId"
    JOIN "Municipality" m ON m.id = o."municipalityId" JOIN "ImportBatch" b ON b.id = o."importBatchId"
    JOIN "OrderStatus" st ON st.id = o."statusId" LEFT JOIN "ManagementPeriod" g ON g.id = o."managementPeriodId"
    WHERE ${where}
  ), elegidos AS (SELECT sid FROM base GROUP BY sid HAVING COUNT(DISTINCT mid) >= ${plan.variasMunicipalidades ? 2 : 1})`;
  const resultado = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SET LOCAL statement_timeout = '7000ms'`;
    const filas = await tx.$queryRaw<ResultadoIA['filas']>(Prisma.sql`${cte}
      SELECT proveedor, slug, municipalidad, "municipalidadSlug", gestion, COUNT(*)::int AS ordenes, COALESCE(SUM(amount),0)::text AS monto
      FROM base WHERE sid IN (SELECT sid FROM elegidos)
      GROUP BY sid, proveedor, slug, mid, municipalidad, "municipalidadSlug", gestion ORDER BY SUM(amount) DESC NULLS LAST, slug, municipalidad, gestion LIMIT 51`);
    const fuentes = await tx.$queryRaw<ResultadoIA['fuentes']>(Prisma.sql`${cte}
      SELECT id, "orderNumber" AS numero, left(description, 240) AS descripcion, municipalidad AS municipio
      FROM base WHERE sid IN (SELECT sid FROM elegidos) ORDER BY amount DESC NULLS LAST, id LIMIT 10`);
    const resumen = await tx.$queryRaw<ResultadoIA['resumen']>(Prisma.sql`${cte}
      SELECT municipalidad, gestion, COUNT(*)::int AS ordenes, COALESCE(SUM(amount),0)::text AS monto
      FROM base WHERE sid IN (SELECT sid FROM elegidos)
      GROUP BY mid, municipalidad, gestion ORDER BY SUM(amount) DESC NULLS LAST, municipalidad, gestion LIMIT 51`);
    return { filas, fuentes, resumen };
  }, { timeout: 24000 });
  return { plan, alcance: plan.municipalidades.length ? plan.municipalidades.join(', ') : 'Todas las municipalidades activas',
    resumen: resultado.resumen.slice(0, 50).map(f => ({ ...f, monto: decimalMonetario(f.monto) })),
    limitado: resultado.filas.length > 50 || resultado.resumen.length > 50, filas: resultado.filas.slice(0, 50).map(f => ({ ...f, monto: decimalMonetario(f.monto) })), fuentes: resultado.fuentes };
}
