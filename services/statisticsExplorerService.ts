import { prisma } from '@/lib/prisma';
import { decimalMonetario } from '@/lib/decimal';
import { MUNICIPALIDAD_DEFAULT_ID } from '@/lib/municipalidad';

export type VentanaEstadistica = 'gestion' | 'primeros-100' | 'ultimo-anio';
export type EstadisticaEtapa = {
  id: string; gestion: string; ventana: VentanaEstadistica; grupo: '10' | '20' | 'otros';
  desde: string; hasta: string; iniciada: boolean;
  meses: number; esperados: number; ordenes: number; anuladas: number; proveedores: number;
  considerado: string; anulado: string; economicas: number;
};

/** Una lectura de las órdenes vigentes de las últimas tres gestiones iniciadas.
 * Los cortes temporales usan fecha de emisión, no fecha de importación.
 */
export async function estadisticasPorEtapa(
  municipalityId = MUNICIPALIDAD_DEFAULT_ID,
): Promise<EstadisticaEtapa[]> {
  const filas = await prisma.$queryRaw<EstadisticaEtapa[]>`
    WITH gestiones AS (
      SELECT id, name, "startDate", "endDate" FROM "ManagementPeriod"
      WHERE "startDate" <= CURRENT_DATE ORDER BY "startDate" DESC, id LIMIT 3
    ), ventanas AS (
      SELECT g.id, g.name, v.ventana, v.desde, v.fin FROM gestiones g
      CROSS JOIN LATERAL (VALUES
        ('gestion', g."startDate", g."endDate" + INTERVAL '1 day'),
        ('primeros-100', g."startDate", LEAST(g."startDate" + INTERVAL '100 days', g."endDate" + INTERVAL '1 day')),
        ('ultimo-anio', GREATEST(g."startDate", date_trunc('year', g."endDate")), g."endDate" + INTERVAL '1 day')
      ) v(ventana, desde, fin)
    ), cobertura AS (
      SELECT v.*,
        (SELECT COUNT(DISTINCT b.period)::int FROM "ImportBatch" b
          WHERE b."managementPeriodId" = v.id AND b."isCurrent" = true
            AND b."municipalityId" = ${municipalityId}
            AND b.status IN ('COMPLETED', 'COMPLETED_WITH_WARNINGS')
            AND make_date(b.year, b.month, 1) < v.fin
            AND make_date(b.year, b.month, 1) + INTERVAL '1 month' > v.desde) AS meses,
        (SELECT COUNT(*)::int FROM generate_series(date_trunc('month', v.desde),
          date_trunc('month', LEAST(v.fin - INTERVAL '1 day', CURRENT_DATE)), INTERVAL '1 month')) AS esperados
      FROM ventanas v
    ), ordenes AS MATERIALIZED (
      SELECT o.id, o."managementPeriodId", o."issueDate", o."supplierId", o.amount, o."isCancelled",
        st."countsEconomically", CASE WHEN left(s.ruc, 2) IN ('10', '20') THEN left(s.ruc, 2) ELSE 'otros' END AS grupo
      FROM "CurrentOrder" o JOIN gestiones g ON g.id = o."managementPeriodId"
      JOIN "Supplier" s ON s.id = o."supplierId" LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
      WHERE o."municipalityId" = ${municipalityId}
    )
    SELECT v.id, v.name AS gestion, v.ventana, r.grupo,
      to_char(v.desde, 'YYYY-MM-DD') AS desde, to_char(v.fin - INTERVAL '1 day', 'YYYY-MM-DD') AS hasta,
      v.desde <= CURRENT_DATE AS iniciada, v.meses, v.esperados,
      COUNT(o.id)::int AS ordenes, COUNT(o.id) FILTER (WHERE o."isCancelled" = true)::int AS anuladas,
      COUNT(DISTINCT o."supplierId")::int AS proveedores,
      COUNT(o.id) FILTER (WHERE o."isCancelled" = false AND o."countsEconomically" = true AND o.amount IS NOT NULL)::int AS economicas,
      COALESCE(SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND o."countsEconomically" = true), 0)::text AS considerado,
      COALESCE(SUM(o.amount) FILTER (WHERE o."isCancelled" = true), 0)::text AS anulado
    FROM cobertura v CROSS JOIN (VALUES ('10'), ('20'), ('otros')) r(grupo)
    LEFT JOIN ordenes o ON o."managementPeriodId" = v.id AND o.grupo = r.grupo
      AND (v.ventana = 'gestion' OR (o."issueDate" >= v.desde AND o."issueDate" < v.fin))
    GROUP BY v.id, v.name, v.ventana, r.grupo, v.desde, v.fin, v.meses, v.esperados
    ORDER BY v.desde, v.id, v.ventana, r.grupo
  `;
  return filas.map(f => ({ ...f, considerado: decimalMonetario(f.considerado), anulado: decimalMonetario(f.anulado) }));
}
