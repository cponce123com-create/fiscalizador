import { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { decimalMonetario } from '@/lib/decimal';
import { catalogoPrensa, posicionPrensa, type ResumenPrensa } from '@/lib/prensa';

/** Un cruce por RUC exacto; no fusiona homónimos ni atribuye órdenes de empresas a personas. */
export async function contratacionesPrensa(catalogo: readonly { ruc: string; nombre: string }[] = catalogoPrensa): Promise<ResumenPrensa> {
  if (!catalogo.length) return { filas: [], conOrdenes: 0, ordenes: 0, considerado: '0.00' };
  const rucs = [...new Set(catalogo.map(p => p.ruc))];
  const agregados = await prisma.$queryRaw<Array<{
    id: string; ruc: string; nombre: string; slug: string; ordenes: number; anuladas: number;
    registrado: string; anulado: string; considerado: string; primera: string | null; ultima: string | null;
    fotoUrl: string | null;
  }>>`
    SELECT s.id, s.ruc, s.name AS nombre, s.slug,
      COUNT(o.id)::int AS ordenes,
      COUNT(o.id) FILTER (WHERE o."isCancelled" = true)::int AS anuladas,
      COALESCE(SUM(o.amount), 0)::text AS registrado,
      COALESCE(SUM(o.amount) FILTER (WHERE o."isCancelled" = true), 0)::text AS anulado,
      COALESCE(SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true), 0)::text AS considerado,
      to_char(MIN(o."issueDate"), 'YYYY-MM-DD') AS primera,
      to_char(MAX(o."issueDate"), 'YYYY-MM-DD') AS ultima,
      CASE WHEN EXISTS (SELECT 1 FROM "SupplierProfile" p WHERE p."supplierId" = s.id AND p."photoKey" IS NOT NULL AND p."isPublic" = true AND p.publication->'foto'->>'enabled' = 'true' AND p.publication->'foto'->>'verifiedAt' IS NOT NULL)
        THEN '/api/public/proveedores/' || s.id || '/foto' ELSE NULL END AS "fotoUrl"
    FROM "Supplier" s JOIN "CurrentOrder" o ON o."supplierId" = s.id
    LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
    WHERE s.ruc IN (${Prisma.join(rucs)})
    GROUP BY s.id, s.ruc, s.name, s.slug
  `;
  const porRuc = new Map(agregados.map(f => [f.ruc, f]));
  const unicos = [...new Map(catalogo.map(p => [p.ruc, p])).values()];
  const filas = unicos.map(persona => {
    const fila = porRuc.get(persona.ruc);
    return {
      ruc: persona.ruc,
      nombre: fila?.nombre ?? persona.nombre,
      nombreListado: persona.nombre,
      tipo: persona.ruc.startsWith('10') ? 'Persona natural' as const : 'Empresa' as const,
      ordenes: fila?.ordenes ?? 0,
      anuladas: fila?.anuladas ?? 0,
      registrado: decimalMonetario(fila?.registrado),
      anulado: decimalMonetario(fila?.anulado),
      considerado: decimalMonetario(fila?.considerado),
      primera: fila?.primera ?? null,
      ultima: fila?.ultima ?? null,
      fotoUrl: fila?.fotoUrl ?? null,
      perfilUrl: fila ? `/proveedores/${fila.slug}` : `/prensa/${persona.ruc}`,
    };
  }).sort((a, b) => posicionPrensa(a.ruc) - posicionPrensa(b.ruc)
    || Number(b.ordenes > 0) - Number(a.ordenes > 0)
    || new Prisma.Decimal(b.considerado).comparedTo(a.considerado)
    || a.nombre.localeCompare(b.nombre, 'es'));
  return {
    filas,
    conOrdenes: filas.filter(f => f.ordenes > 0).length,
    ordenes: filas.reduce((suma, f) => suma + f.ordenes, 0),
    considerado: filas.reduce((suma, f) => suma.plus(f.considerado), new Prisma.Decimal(0)).toFixed(2),
  };
}
