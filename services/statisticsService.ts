import { prisma } from '@/lib/prisma';

/**
 * Agregaciones del portal público.
 *
 * Regla que gobierna este módulo (secciones 22 y 23 del pliego): **ninguna suma se
 * hace en el navegador**. Cada bloque del dashboard se resuelve con una consulta
 * agregada en PostgreSQL y devuelve solo el resultado. Enviar las órdenes al
 * cliente para sumarlas allí funcionaría con 103 filas y dejaría de funcionar
 * con 100.000.
 *
 * Todos los montos se devuelven como CADENA decimal con dos decimales, nunca como
 * `number`. Son `Decimal` en la base de datos; convertirlos a coma flotante en el
 * camino perdería exactitud, que es la prioridad declarada del proyecto.
 */

/** Monto normalizado a dos decimales, como cadena. */
function aDecimal2(valor: unknown): string {
  if (valor === null || valor === undefined) return '0.00';

  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero)) return '0.00';

  return numero.toFixed(2);
}

/** Convierte un bigint de PostgreSQL a number de forma segura para conteos. */
function aNumero(valor: unknown): number {
  if (valor === null || valor === undefined) return 0;
  const numero = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

/** Peso porcentual, redondeado a un decimal. Solo para mostrar. */
function porcentaje(parte: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((parte / total) * 1000) / 10;
}

// =============================================================================
// Resumen general (las tarjetas)
// =============================================================================

export type ResumenGeneral = {
  ordenes: number;
  ordenesAnuladas: number;
  proveedores: number;
  proveedoresRuc10: number;
  proveedoresRuc20: number;
  totalRegistrado: string;
  totalAnulado: string;
  totalConsiderado: string;
  /** Cuántos periodos distintos hay cargados. Menos de 2 degenera los gráficos. */
  mesesCargados: number;
  aniosCargados: number;
  gestionesConDatos: number;
  primerPeriodo: string | null;
  ultimoPeriodo: string | null;
};

export async function resumenGeneral(): Promise<ResumenGeneral> {
  const [
    ordenes,
    anuladas,
    proveedores,
    ruc10,
    ruc20,
    registrado,
    anulado,
    considerado,
    periodos,
    gestiones,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { isCancelled: true } }),
    prisma.supplier.count(),
    prisma.supplier.count({ where: { rucPrefix: '10' } }),
    prisma.supplier.count({ where: { rucPrefix: '20' } }),
    prisma.order.aggregate({ _sum: { amount: true } }),
    prisma.order.aggregate({ where: { isCancelled: true }, _sum: { amount: true } }),
    // El monto considerado excluye las anuladas Y los estados que el catálogo marca
    // como que no cuentan económicamente.
    prisma.order.aggregate({
      where: { isCancelled: false, status: { countsEconomically: true } },
      _sum: { amount: true },
    }),
    // Cobertura temporal: determina si los gráficos de evolución tienen sentido.
    prisma.$queryRaw<Array<{ meses: bigint; anios: bigint; primero: string | null; ultimo: string | null }>>`
      SELECT
        COUNT(DISTINCT to_char("issueDate", 'YYYY-MM')) AS meses,
        COUNT(DISTINCT to_char("issueDate", 'YYYY'))    AS anios,
        MIN(to_char("issueDate", 'YYYY-MM'))            AS primero,
        MAX(to_char("issueDate", 'YYYY-MM'))            AS ultimo
      FROM "Order"
      WHERE "issueDate" IS NOT NULL
    `,
    prisma.supplierManagementSummary.groupBy({ by: ['managementPeriodId'] }),
  ]);

  const cobertura = periodos[0];

  return {
    ordenes,
    ordenesAnuladas: anuladas,
    proveedores,
    proveedoresRuc10: ruc10,
    proveedoresRuc20: ruc20,
    totalRegistrado: aDecimal2(registrado._sum.amount),
    totalAnulado: aDecimal2(anulado._sum.amount),
    totalConsiderado: aDecimal2(considerado._sum.amount),
    mesesCargados: aNumero(cobertura?.meses),
    aniosCargados: aNumero(cobertura?.anios),
    gestionesConDatos: gestiones.length,
    primerPeriodo: cobertura?.primero ?? null,
    ultimoPeriodo: cobertura?.ultimo ?? null,
  };
}

// =============================================================================
// Ranking de proveedores
// =============================================================================

export type FilaRanking = {
  supplierId: string;
  ruc: string;
  nombre: string;
  slug: string;
  ordenes: number;
  anuladas: number;
  considerado: string;
  /** Peso sobre el monto considerado total. Es lo que hace legible la cifra. */
  peso: number;
};

/**
 * Proveedores ordenados por monto considerado, con su peso sobre el total.
 *
 * Se agrupa sobre `Order` en lugar de leer `SupplierManagementSummary` para que el
 * ranking siga siendo correcto cuando haya varias gestiones cargadas: agrupa por
 * proveedor a través de todas ellas, no gestión a gestión.
 */
export async function rankingProveedores(limite = 15): Promise<FilaRanking[]> {
  const filas = await prisma.$queryRaw<
    Array<{
      id: string;
      ruc: string;
      name: string;
      slug: string;
      ordenes: number;
      anuladas: number;
      considerado: string;
      total_considerado: string;
    }>
  >`
    SELECT
      s.id,
      s.ruc,
      s.name,
      s.slug,
      COUNT(*)::int AS ordenes,
      COUNT(*) FILTER (WHERE o."isCancelled" = true)::int AS anuladas,
      COALESCE(
        SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true),
        0
      )::text AS considerado,
      -- El peso debe calcularse sobre el total de TODOS los proveedores, no sobre
      -- los que devuelve el LIMIT. La función de ventana se evalúa antes del
      -- LIMIT, así que da el total real en la misma consulta.
      COALESCE(
        SUM(SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true)) OVER (),
        0
      )::text AS total_considerado
    FROM "Order" o
    JOIN "Supplier" s ON s.id = o."supplierId"
    LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
    GROUP BY s.id, s.ruc, s.name, s.slug
    ORDER BY COALESCE(
      SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true),
      0
    ) DESC
    LIMIT ${limite}
  `;

  const totalConsiderado = Number(filas[0]?.total_considerado ?? 0);

  return filas.map((fila) => ({
    supplierId: fila.id,
    ruc: fila.ruc,
    nombre: fila.name,
    slug: fila.slug,
    ordenes: aNumero(fila.ordenes),
    anuladas: aNumero(fila.anuladas),
    considerado: aDecimal2(fila.considerado),
    peso: porcentaje(Number(fila.considerado), totalConsiderado),
  }));
}

// =============================================================================
// Evolución
// =============================================================================

export type PuntoEvolucion = {
  /** Etiqueta del eje: `2023-06` o `2023`. */
  periodo: string;
  ordenes: number;
  registrado: string;
  considerado: string;
};

/**
 * Serie agregada por periodo.
 *
 * Se usa SQL crudo porque Prisma no permite agrupar por una función de fecha. Los
 * parámetros van interpolados por la plantilla de Prisma, nunca concatenados.
 */
async function seriePorPeriodo(formato: 'YYYY-MM' | 'YYYY'): Promise<PuntoEvolucion[]> {
  const filas = await prisma.$queryRaw<
    Array<{ periodo: string; ordenes: number; registrado: string; considerado: string }>
  >`
    SELECT
      to_char(o."issueDate", ${formato}) AS periodo,
      COUNT(*)::int AS ordenes,
      COALESCE(SUM(o.amount), 0)::text AS registrado,
      COALESCE(
        SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true),
        0
      )::text AS considerado
    FROM "Order" o
    LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
    WHERE o."issueDate" IS NOT NULL
    GROUP BY 1
    ORDER BY 1
  `;

  return filas.map((fila) => ({
    periodo: fila.periodo,
    ordenes: aNumero(fila.ordenes),
    registrado: aDecimal2(fila.registrado),
    considerado: aDecimal2(fila.considerado),
  }));
}

export function evolucionMensual(): Promise<PuntoEvolucion[]> {
  return seriePorPeriodo('YYYY-MM');
}

export function evolucionAnual(): Promise<PuntoEvolucion[]> {
  return seriePorPeriodo('YYYY');
}

// =============================================================================
// Gasto por gestión
// =============================================================================

export type FilaGestion = {
  gestion: string;
  ordenes: number;
  proveedores: number;
  considerado: string;
};

export async function gastoPorGestion(): Promise<FilaGestion[]> {
  const filas = await prisma.$queryRaw<
    Array<{ gestion: string; ordenes: number; proveedores: number; considerado: string }>
  >`
    SELECT
      g.name AS gestion,
      COUNT(o.id)::int AS ordenes,
      COUNT(DISTINCT o."supplierId")::int AS proveedores,
      COALESCE(
        SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true),
        0
      )::text AS considerado
    FROM "ManagementPeriod" g
    LEFT JOIN "Order" o ON o."managementPeriodId" = g.id
    LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
    GROUP BY g.name
    ORDER BY g.name
  `;

  return filas.map((fila) => ({
    gestion: fila.gestion,
    ordenes: aNumero(fila.ordenes),
    proveedores: aNumero(fila.proveedores),
    considerado: aDecimal2(fila.considerado),
  }));
}

// =============================================================================
// Tipos de contratación
// =============================================================================

export type FilaContratacion = {
  etiqueta: string;
  ordenes: number;
  registrado: string;
  considerado: string;
};

export async function tiposContratacion(limite = 8): Promise<FilaContratacion[]> {
  const filas = await prisma.$queryRaw<
    Array<{ etiqueta: string; ordenes: number; registrado: string; considerado: string }>
  >`
    SELECT
      COALESCE(c.label, 'Sin clasificar') AS etiqueta,
      COUNT(*)::int AS ordenes,
      COALESCE(SUM(o.amount), 0)::text AS registrado,
      COALESCE(
        SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true),
        0
      )::text AS considerado
    FROM "Order" o
    LEFT JOIN "ContractType" c ON c.id = o."contractTypeId"
    LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
    GROUP BY 1
    ORDER BY COALESCE(SUM(o.amount), 0) DESC
    LIMIT ${limite}
  `;

  return filas.map((fila) => ({
    etiqueta: fila.etiqueta,
    ordenes: aNumero(fila.ordenes),
    registrado: aDecimal2(fila.registrado),
    considerado: aDecimal2(fila.considerado),
  }));
}

// =============================================================================
// Reparto por tipo de orden
// =============================================================================

export type FilaTipoOrden = {
  codigo: string;
  etiqueta: string;
  ordenes: number;
  registrado: string;
  considerado: string;
};

export async function repartoPorTipoOrden(): Promise<FilaTipoOrden[]> {
  const filas = await prisma.$queryRaw<
    Array<{ codigo: string; etiqueta: string; ordenes: number; registrado: string; considerado: string }>
  >`
    SELECT
      COALESCE(t.code, '—') AS codigo,
      COALESCE(t.label, 'Sin clasificar') AS etiqueta,
      COUNT(*)::int AS ordenes,
      COALESCE(SUM(o.amount), 0)::text AS registrado,
      COALESCE(
        SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true),
        0
      )::text AS considerado
    FROM "Order" o
    LEFT JOIN "OrderType" t ON t.id = o."orderTypeId"
    LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
    GROUP BY 1, 2
    ORDER BY COALESCE(SUM(o.amount), 0) DESC
  `;

  return filas.map((fila) => ({
    codigo: fila.codigo,
    etiqueta: fila.etiqueta,
    ordenes: aNumero(fila.ordenes),
    registrado: aDecimal2(fila.registrado),
    considerado: aDecimal2(fila.considerado),
  }));
}

// =============================================================================
// Últimos registros
// =============================================================================

export type FilaUltimoRegistro = {
  id: string;
  orderNumber: string;
  issueDate: Date | null;
  amount: string | null;
  isCancelled: boolean;
  proveedor: string;
  ruc: string;
  tipo: string | null;
  estado: string | null;
};

export async function ultimosRegistros(limite = 8): Promise<FilaUltimoRegistro[]> {
  const ordenes = await prisma.order.findMany({
    orderBy: [{ issueDate: 'desc' }, { sourceRow: 'asc' }],
    take: limite,
    select: {
      id: true,
      orderNumber: true,
      issueDate: true,
      amount: true,
      isCancelled: true,
      ruc: true,
      orderType: { select: { code: true } },
      status: { select: { label: true } },
      supplier: { select: { name: true } },
    },
  });

  return ordenes.map((orden) => ({
    id: orden.id,
    orderNumber: orden.orderNumber,
    issueDate: orden.issueDate,
    amount: orden.amount === null ? null : orden.amount.toFixed(2),
    isCancelled: orden.isCancelled,
    proveedor: orden.supplier.name,
    ruc: orden.ruc,
    tipo: orden.orderType?.code ?? null,
    estado: orden.status?.label ?? null,
  }));
}

// =============================================================================
// Carga conjunta de la portada
// =============================================================================

export type DatosPortada = {
  resumen: ResumenGeneral;
  ranking: FilaRanking[];
  mensual: PuntoEvolucion[];
  anual: PuntoEvolucion[];
  gestiones: FilaGestion[];
  contrataciones: FilaContratacion[];
  tiposOrden: FilaTipoOrden[];
  ultimos: FilaUltimoRegistro[];
};

/**
 * Reúne todo lo que necesita la portada.
 *
 * Las consultas se lanzan en paralelo: son independientes entre sí y en serie
 * sumarían latencia sin motivo.
 */
export async function datosPortada(): Promise<DatosPortada> {
  const [resumen, ranking, mensual, anual, gestiones, contrataciones, tiposOrden, ultimos] =
    await Promise.all([
      resumenGeneral(),
      rankingProveedores(10),
      evolucionMensual(),
      evolucionAnual(),
      gastoPorGestion(),
      tiposContratacion(6),
      repartoPorTipoOrden(),
      ultimosRegistros(8),
    ]);

  return { resumen, ranking, mensual, anual, gestiones, contrataciones, tiposOrden, ultimos };
}
