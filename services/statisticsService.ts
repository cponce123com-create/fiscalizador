import type { Prisma } from '@/lib/generated/prisma/client';
import { type Filtros, rangoDeFechas } from '@/lib/filtros';
import { prisma } from '@/lib/prisma';
import { decimalMonetario } from '@/lib/decimal';

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
const aDecimal2 = decimalMonetario;

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
    prisma.order.count({ where: { importBatch: { isCurrent: true } } }),
    prisma.order.count({ where: { isCancelled: true, importBatch: { isCurrent: true } } }),
    prisma.supplier.count({ where: { orders: { some: { importBatch: { isCurrent: true } } } } }),
    prisma.supplier.count({ where: { rucPrefix: '10', orders: { some: { importBatch: { isCurrent: true } } } } }),
    prisma.supplier.count({ where: { rucPrefix: '20', orders: { some: { importBatch: { isCurrent: true } } } } }),
    prisma.order.aggregate({ where: { importBatch: { isCurrent: true } }, _sum: { amount: true } }),
    prisma.order.aggregate({ where: { isCancelled: true, importBatch: { isCurrent: true } }, _sum: { amount: true } }),
    // El monto considerado excluye las anuladas Y los estados que el catálogo marca
    // como que no cuentan económicamente.
    prisma.order.aggregate({
      where: { isCancelled: false, status: { countsEconomically: true }, importBatch: { isCurrent: true } },
      _sum: { amount: true },
    }),
    // Cobertura temporal: determina si los gráficos de evolución tienen sentido.
    prisma.$queryRaw<Array<{ meses: bigint; anios: bigint; primero: string | null; ultimo: string | null }>>`
      SELECT
        COUNT(DISTINCT (year, month)) AS meses,
        COUNT(DISTINCT year)    AS anios,
        MIN(year::text || '-' || lpad(month::text, 2, '0'))            AS primero,
        MAX(year::text || '-' || lpad(month::text, 2, '0'))            AS ultimo
      FROM "ImportBatch"
      WHERE "isCurrent" = true
    `,
    prisma.supplierManagementSummary.groupBy({ by: ['managementPeriodId'], where: { orderCount: { gt: 0 } } }),
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
  fotoUrl?: string | null;
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
      photoUrl: string | null;
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
      CASE WHEN EXISTS (SELECT 1 FROM "SupplierProfile" p WHERE p."supplierId" = s.id AND p."photoKey" IS NOT NULL AND p."isPublic" = true AND p.publication->'foto'->>'enabled' = 'true' AND p.publication->'foto'->>'verifiedAt' IS NOT NULL)
        THEN '/api/public/proveedores/' || s.id || '/foto'
        ELSE NULL END AS "photoUrl",
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
    FROM "CurrentOrder" o
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
    fotoUrl: fila.photoUrl ?? null,
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
    FROM "CurrentOrder" o
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
    LEFT JOIN "CurrentOrder" o ON o."managementPeriodId" = g.id
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
// Comparativa entre gestiones (estadísticas)
// =============================================================================

export type FilaComparativa = {
  gestion: string;
  ordenes: number;
  anuladas: number;
  proveedores: number;
  registrado: string;
  anulado: string;
  considerado: string;
  /** Peso del monto considerado sobre el total del portal, en porcentaje. */
  peso: number;
  /** Monto considerado medio por orden. */
  ticketMedio: string;
};

/**
 * Comparación del gasto entre gestiones de gobierno.
 *
 * Es la tabla que responde a «¿cuánto se gastó en cada gestión?» sin obligar al
 * ciudadano a recorrer tres pantallas. Se incluyen las gestiones sin datos: una
 * fila en cero explica que el periodo existe y no está cargado, que es distinto de
 * no existir.
 *
 * Los tres montos van separados por la misma razón que en el resto del portal: una
 * orden anulada se cuenta, pero no suma al considerado.
 */
export async function comparativaPorGestion(): Promise<FilaComparativa[]> {
  const filas = await prisma.$queryRaw<
    Array<{
      gestion: string;
      ordenes: number;
      anuladas: number;
      proveedores: number;
      registrado: string;
      anulado: string;
      considerado: string;
      promedio: string;
    }>
  >`
    SELECT
      g.name AS gestion,
      COUNT(o.id)::int AS ordenes,
      COUNT(o.id) FILTER (WHERE o."isCancelled" = true)::int AS anuladas,
      COUNT(DISTINCT o."supplierId")::int AS proveedores,
      COALESCE(SUM(o.amount), 0)::text AS registrado,
      COALESCE(SUM(o.amount) FILTER (WHERE o."isCancelled" = true), 0)::text AS anulado,
      COALESCE(
        SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true),
        0
      )::text AS considerado,
      COALESCE(AVG(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true), 0)::text AS promedio
    FROM "ManagementPeriod" g
    LEFT JOIN "CurrentOrder" o ON o."managementPeriodId" = g.id
    LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
    GROUP BY g.name
    ORDER BY g.name
  `;

  // El peso se calcula contra el total del portal, no contra la fila mayor: así la
  // suma de los pesos de todas las gestiones es el 100%.
  const total = filas.reduce((acumulado, fila) => acumulado + Number(fila.considerado), 0);

  return filas.map((fila) => {
    const ordenes = aNumero(fila.ordenes);
    const considerado = aDecimal2(fila.considerado);

    return {
      gestion: fila.gestion,
      ordenes,
      anuladas: aNumero(fila.anuladas),
      proveedores: aNumero(fila.proveedores),
      registrado: aDecimal2(fila.registrado),
      anulado: aDecimal2(fila.anulado),
      considerado,
      peso: porcentaje(Number(considerado), total),
      ticketMedio: aDecimal2(fila.promedio),
    };
  });
}

// =============================================================================
// Concentración del gasto
// =============================================================================

export type CorteConcentracion = {
  /** Cuántos proveedores entran en el corte. */
  proveedores: number;
  considerado: string;
  /** Parte del monto considerado total que concentran, en porcentaje. */
  peso: number;
};

export type ConcentracionGasto = {
  totalProveedores: number;
  totalConsiderado: string;
  cortes: CorteConcentracion[];
};

/**
 * Cuánto del gasto se concentra en los mayores proveedores.
 *
 * La suma acumulada se resuelve con una función de ventana en PostgreSQL —ordenada
 * por monto— y solo se devuelven los cortes pedidos, no la lista entera de
 * proveedores. El reparto exacto entre proveedores está en el ranking; aquí interesa
 * la forma de la concentración.
 *
 * Los cortes están fijados en la consulta (1, 5, 10 y 20) porque son los que muestra
 * la página. Hacerlos dinámicos obligaría a componer SQL con `IN`, que es justo lo
 * que este módulo evita.
 */
export async function concentracionGasto(): Promise<ConcentracionGasto> {
  const filas = await prisma.$queryRaw<
    Array<{
      totalProveedores: number;
      totalConsiderado: string;
      top1: string;
      top5: string;
      top10: string;
      top20: string;
    }>
  >`
    WITH por_proveedor AS (
      SELECT
        s.id,
        COALESCE(
          SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true),
          0
        ) AS considerado
      FROM "Supplier" s
      JOIN "CurrentOrder" o ON o."supplierId" = s.id
      LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
      GROUP BY s.id
    ),
    acumulado AS (
      SELECT
        ROW_NUMBER() OVER (ORDER BY p.considerado DESC, p.id) AS posicion,
        SUM(p.considerado) OVER (
          ORDER BY p.considerado DESC, p.id
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS corrido
      FROM por_proveedor p
    )
    SELECT
      COUNT(*)::int AS "totalProveedores",
      COALESCE(MAX(a.corrido), 0)::text AS "totalConsiderado",
      COALESCE(MAX(a.corrido) FILTER (WHERE a.posicion <= 1), 0)::text AS "top1",
      COALESCE(MAX(a.corrido) FILTER (WHERE a.posicion <= 5), 0)::text AS "top5",
      COALESCE(MAX(a.corrido) FILTER (WHERE a.posicion <= 10), 0)::text AS "top10",
      COALESCE(MAX(a.corrido) FILTER (WHERE a.posicion <= 20), 0)::text AS "top20"
    FROM acumulado a
  `;

  const fila = filas[0];
  const totalConsiderado = aDecimal2(fila?.totalConsiderado);
  const total = Number(totalConsiderado);

  const valores: Array<{ proveedores: number; valor: string | undefined }> = [
    { proveedores: 1, valor: fila?.top1 },
    { proveedores: 5, valor: fila?.top5 },
    { proveedores: 10, valor: fila?.top10 },
    { proveedores: 20, valor: fila?.top20 },
  ];

  return {
    totalProveedores: aNumero(fila?.totalProveedores),
    totalConsiderado,
    cortes: valores.map((corte) => {
      const considerado = aDecimal2(corte.valor);
      return {
        proveedores: corte.proveedores,
        considerado,
        peso: porcentaje(Number(considerado), total),
      };
    }),
  };
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
    FROM "CurrentOrder" o
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
    FROM "CurrentOrder" o
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
  descripcion?: string | null;
};

export async function ultimosRegistros(limite = 8): Promise<FilaUltimoRegistro[]> {
  const ordenes = await prisma.order.findMany({
    where: { importBatch: { isCurrent: true } },
    orderBy: [{ issueDate: 'desc' }, { sourceRow: 'asc' }],
    take: limite,
    select: {
      id: true,
      orderNumber: true,
      description: true,
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
    descripcion: orden.description,
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

// =============================================================================
// Listados paginados
// =============================================================================

export type ResultadoPaginado<T> = {
  filas: T[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
};

/** Años con órdenes. Alimenta los desplegables y el filtro por mes suelto. */
export async function aniosDisponibles(): Promise<number[]> {
  const filas = await prisma.$queryRaw<Array<{ anio: string }>>`
    SELECT DISTINCT to_char("issueDate", 'YYYY') AS anio
    FROM "CurrentOrder"
    WHERE "issueDate" IS NOT NULL
    ORDER BY 1 DESC
  `;

  return filas.map((fila) => Number(fila.anio)).filter((anio) => Number.isFinite(anio));
}

/**
 * Traduce los filtros de la URL a una condición de Prisma.
 *
 * Las condiciones se acumulan en un array y se combinan con `AND`, en lugar de
 * anidar objetos. Así la búsqueda por texto —que necesita su propio `OR`— no
 * pisa a los demás filtros.
 */
export async function construirWhereOrdenes(filtros: Filtros): Promise<Prisma.OrderWhereInput> {
  const condiciones: Prisma.OrderWhereInput[] = [{ importBatch: { isCurrent: true } }];

  const rango = rangoDeFechas(filtros);
  if (rango) {
    condiciones.push({ issueDate: { gte: rango.gte, lt: rango.lt } });
  }

  // Un mes sin año no cabe en un solo rango. En vez de descartarlo en silencio, se
  // construye una condición por cada año presente: `?mes=6` significa «junio de
  // cualquier año».
  if (filtros.mes !== null && filtros.anio === null) {
    const anios = await aniosDisponibles();

    if (anios.length === 0) {
      // Sin años cargados no hay nada que buscar. Un `in` vacío no devuelve filas.
      condiciones.push({ id: { in: [] } });
    } else {
      condiciones.push({
        OR: anios.map((anio) => ({
          issueDate: {
            gte: new Date(Date.UTC(anio, filtros.mes! - 1, 1)),
            lt: new Date(Date.UTC(anio, filtros.mes!, 1)),
          },
        })),
      });
    }
  }

  if (filtros.gestionId) condiciones.push({ managementPeriodId: filtros.gestionId });
  if (filtros.tipoOrdenId) condiciones.push({ orderTypeId: filtros.tipoOrdenId });
  if (filtros.estadoId) condiciones.push({ statusId: filtros.estadoId });
  if (filtros.proveedorId) condiciones.push({ supplierId: filtros.proveedorId });
  if (filtros.tipoRuc) condiciones.push({ supplier: { rucPrefix: filtros.tipoRuc } });

  if (filtros.texto) {
    const t = filtros.texto;
    condiciones.push({
      OR: [
        { orderNumber: { contains: t, mode: 'insensitive' } },
        { description: { contains: t, mode: 'insensitive' } },
        { siafNumber: { contains: t, mode: 'insensitive' } },
        { ruc: { contains: t } },
        { supplier: { name: { contains: t, mode: 'insensitive' } } },
      ],
    });
  }

  return condiciones.length > 0 ? { AND: condiciones } : {};
}

/** Orden solicitado, siempre con un desempate para que la paginación sea estable. */
function ordenDeOrdenes(filtros: Filtros): Prisma.OrderOrderByWithRelationInput[] {
  const direccion = filtros.direccion;

  if (filtros.orden === 'monto') {
    return [{ amount: direccion }, { orderNumber: 'asc' }];
  }
  if (filtros.orden === 'proveedor') {
    return [{ supplier: { name: direccion } }, { issueDate: 'desc' }, { sourceRow: 'asc' }];
  }
  return [{ issueDate: direccion }, { sourceRow: 'asc' }];
}

export type FilaOrdenListado = {
  id: string;
  orderNumber: string;
  issueDate: Date | null;
  /** Puede faltar: la columna es opcional en el archivo de origen. */
  description: string | null;
  amount: string | null;
  ruc: string;
  isCancelled: boolean;
  tipo: string | null;
  estado: string | null;
  proveedor: string;
  proveedorSlug: string;
};

/**
 * Listado público de órdenes, paginado.
 *
 * La paginación se hace con `skip`/`take` en la consulta, no trayendo todo y
 * cortando después: es lo que exige la sección 22 del pliego («no cargar miles de
 * registros al navegador»).
 */
export async function listarOrdenes(
  filtros: Filtros,
): Promise<ResultadoPaginado<FilaOrdenListado>> {
  const where = await construirWhereOrdenes(filtros);

  const [total, ordenes] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: ordenDeOrdenes(filtros),
      skip: (filtros.pagina - 1) * filtros.porPagina,
      take: filtros.porPagina,
      select: {
        id: true,
        orderNumber: true,
        issueDate: true,
        description: true,
        amount: true,
        ruc: true,
        isCancelled: true,
        orderType: { select: { code: true } },
        status: { select: { label: true } },
        supplier: { select: { name: true, slug: true } },
      },
    }),
  ]);

  return {
    filas: ordenes.map((orden) => ({
      id: orden.id,
      orderNumber: orden.orderNumber,
      issueDate: orden.issueDate,
      description: orden.description,
      amount: orden.amount === null ? null : orden.amount.toFixed(2),
      ruc: orden.ruc,
      isCancelled: orden.isCancelled,
      tipo: orden.orderType?.code ?? null,
      estado: orden.status?.label ?? null,
      proveedor: orden.supplier.name,
      proveedorSlug: orden.supplier.slug,
    })),
    total,
    pagina: filtros.pagina,
    porPagina: filtros.porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / filtros.porPagina)),
  };
}

/** Opciones de los desplegables de filtro. */
export async function opcionesDeFiltros(): Promise<{
  anios: number[];
  gestiones: { id: string; nombre: string }[];
  tiposOrden: { id: string; etiqueta: string }[];
  estados: { id: string; etiqueta: string }[];
}> {
  const [anios, gestiones, tiposOrden, estados] = await Promise.all([
    aniosDisponibles(),
    prisma.managementPeriod.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.orderType.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, code: true, label: true },
    }),
    prisma.orderStatus.findMany({
      orderBy: { label: 'asc' },
      select: { id: true, label: true },
    }),
  ]);

  return {
    anios,
    gestiones: gestiones.map((g) => ({ id: g.id, nombre: g.name })),
    tiposOrden: tiposOrden.map((t) => ({
      id: t.id,
      etiqueta: t.label ? `${t.code} · ${t.label}` : t.code,
    })),
    estados: estados.map((e) => ({ id: e.id, etiqueta: e.label })),
  };
}

// =============================================================================
// Proveedores
// =============================================================================

/** Etiqueta en español del tipo de proveedor, tal como lo define el pliego. */
export function etiquetaTipoProveedor(tipo: string | null): string {
  switch (tipo) {
    case 'PERSONA_NATURAL':
      return 'Persona natural';
    case 'PERSONA_JURIDICA':
      return 'Persona jurídica';
    case 'OTRO':
      return 'Otro';
    default:
      return 'Sin determinar';
  }
}

export type FilaProveedorListado = {
  id: string;
  ruc: string;
  nombre: string;
  slug: string;
  tipo: string;
  ordenes: number;
  considerado: string;
  primeraAparicion: string | null;
  ultimaAparicion: string | null;
};

/**
 * Listado de proveedores, alfabético y paginado.
 *
 * Las agregaciones (número de órdenes, monto, primera y última aparición) se
 * calculan en PostgreSQL con `GROUP BY`, y solo se traen las filas de la página
 * pedida. Traer los 72 proveedores con sus 103 órdenes para sumar en el servidor
 * de Next.js funcionaría hoy y no funcionaría con un año entero de libros.
 */
export async function listarProveedores(
  filtros: Filtros,
): Promise<ResultadoPaginado<FilaProveedorListado>> {
  const texto = filtros.texto ?? '';
  const tipoRuc = filtros.tipoRuc ?? '';

  const [conteo, filas] = await Promise.all([
    prisma.$queryRaw<Array<{ n: number }>>`
      SELECT COUNT(DISTINCT s.id)::int AS n
      FROM "Supplier" s JOIN "CurrentOrder" o ON o."supplierId" = s.id
      WHERE (${texto} = '' OR s.name ILIKE '%' || ${texto} || '%' OR s.ruc LIKE '%' || ${texto} || '%')
        AND (${tipoRuc} = '' OR s."rucPrefix" = ${tipoRuc})
    `,
    prisma.$queryRaw<
      Array<{
        id: string;
        ruc: string;
        name: string;
        slug: string;
        supplierType: string | null;
        ordenes: number;
        considerado: string;
        primera: string | null;
        ultima: string | null;
      }>
    >`
      SELECT
        s.id,
        s.ruc,
        s.name,
        s.slug,
        s."supplierType",
        COUNT(o.id)::int AS ordenes,
        COALESCE(
          SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true),
          0
        )::text AS considerado,
        to_char(MIN(o."issueDate"), 'YYYY-MM-DD') AS primera,
        to_char(MAX(o."issueDate"), 'YYYY-MM-DD') AS ultima
      FROM "Supplier" s
      JOIN "CurrentOrder" o ON o."supplierId" = s.id
      LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
      WHERE (${texto} = '' OR s.name ILIKE '%' || ${texto} || '%' OR s.ruc LIKE '%' || ${texto} || '%')
        AND (${tipoRuc} = '' OR s."rucPrefix" = ${tipoRuc})
      GROUP BY s.id, s.ruc, s.name, s.slug, s."supplierType"
      ORDER BY s.name ASC
      LIMIT ${filtros.porPagina} OFFSET ${(filtros.pagina - 1) * filtros.porPagina}
    `,
  ]);

  const total = conteo[0]?.n ?? 0;

  return {
    filas: filas.map((fila) => ({
      id: fila.id,
      ruc: fila.ruc,
      nombre: fila.name,
      slug: fila.slug,
      tipo: etiquetaTipoProveedor(fila.supplierType),
      ordenes: aNumero(fila.ordenes),
      considerado: aDecimal2(fila.considerado),
      primeraAparicion: fila.primera,
      ultimaAparicion: fila.ultima,
    })),
    total,
    pagina: filtros.pagina,
    porPagina: filtros.porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / filtros.porPagina)),
  };
}

// =============================================================================
// Perfil del proveedor
// =============================================================================

export type PerfilProveedor = {
  id: string;
  ruc: string;
  nombre: string;
  slug: string;
  tipo: string;
  fotoUrl: string | null;
  ordenes: number;
  anuladas: number;
  totalRegistrado: string;
  totalAnulado: string;
  totalConsiderado: string;
  primeraAparicion: string | null;
  ultimaAparicion: string | null;
  aniosPresentes: number[];
  porGestion: { etiqueta: string; ordenes: number; considerado: string }[];
  porAnio: { etiqueta: string; ordenes: number; considerado: string }[];
  porMes: { etiqueta: string; ordenes: number; considerado: string }[];
};

/**
 * Perfil público de un proveedor, buscado por su identificador legible.
 *
 * Se devuelven los tres montos por separado —registrado, anulado y considerado—
 * porque es lo que la sección 14 del pliego exige dejar claro: una orden anulada
 * existe y se muestra, pero no suma.
 */
export async function perfilProveedor(slug: string): Promise<PerfilProveedor | null> {
  const proveedor = await prisma.supplier.findUnique({
    where: { slug },
    select: { id: true, ruc: true, name: true, slug: true, supplierType: true, photoUrl: true },
  });

  if (!proveedor) return null;

  const [totales, gestion, anio, mes] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        ordenes: number;
        anuladas: number;
        registrado: string;
        anulado: string;
        considerado: string;
        primera: string | null;
        ultima: string | null;
      }>
    >`
      SELECT
        COUNT(*)::int AS ordenes,
        COUNT(*) FILTER (WHERE o."isCancelled" = true)::int AS anuladas,
        COALESCE(SUM(o.amount), 0)::text AS registrado,
        COALESCE(SUM(o.amount) FILTER (WHERE o."isCancelled" = true), 0)::text AS anulado,
        COALESCE(
          SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true),
          0
        )::text AS considerado,
        to_char(MIN(o."issueDate"), 'YYYY-MM-DD') AS primera,
        to_char(MAX(o."issueDate"), 'YYYY-MM-DD') AS ultima
      FROM "CurrentOrder" o
      LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
      WHERE o."supplierId" = ${proveedor.id}
    `,
    prisma.$queryRaw<Array<{ etiqueta: string; ordenes: number; considerado: string }>>`
      SELECT
        g.name AS etiqueta,
        COUNT(o.id)::int AS ordenes,
        COALESCE(
          SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true),
          0
        )::text AS considerado
      FROM "CurrentOrder" o
      JOIN "ManagementPeriod" g ON g.id = o."managementPeriodId"
      LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
      WHERE o."supplierId" = ${proveedor.id}
      GROUP BY g.name
      ORDER BY g.name
    `,
    prisma.$queryRaw<Array<{ etiqueta: string; ordenes: number; considerado: string }>>`
      SELECT
        to_char(o."issueDate", 'YYYY') AS etiqueta,
        COUNT(*)::int AS ordenes,
        COALESCE(
          SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true),
          0
        )::text AS considerado
      FROM "CurrentOrder" o
      LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
      WHERE o."supplierId" = ${proveedor.id} AND o."issueDate" IS NOT NULL
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw<Array<{ etiqueta: string; ordenes: number; considerado: string }>>`
      SELECT
        to_char(o."issueDate", 'YYYY-MM') AS etiqueta,
        COUNT(*)::int AS ordenes,
        COALESCE(
          SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true),
          0
        )::text AS considerado
      FROM "CurrentOrder" o
      LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
      WHERE o."supplierId" = ${proveedor.id} AND o."issueDate" IS NOT NULL
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  const t = totales[0];

  const mapear = (filas: Array<{ etiqueta: string; ordenes: number; considerado: string }>) =>
    filas.map((fila) => ({
      etiqueta: fila.etiqueta,
      ordenes: aNumero(fila.ordenes),
      considerado: aDecimal2(fila.considerado),
    }));

  return {
    id: proveedor.id,
    ruc: proveedor.ruc,
    nombre: proveedor.name,
    slug: proveedor.slug,
    tipo: etiquetaTipoProveedor(proveedor.supplierType),
    fotoUrl: proveedor.photoUrl,
    ordenes: aNumero(t?.ordenes),
    anuladas: aNumero(t?.anuladas),
    totalRegistrado: aDecimal2(t?.registrado),
    totalAnulado: aDecimal2(t?.anulado),
    totalConsiderado: aDecimal2(t?.considerado),
    primeraAparicion: t?.primera ?? null,
    ultimaAparicion: t?.ultima ?? null,
    aniosPresentes: anio.map((fila) => Number(fila.etiqueta)).filter((n) => Number.isFinite(n)),
    porGestion: mapear(gestion),
    porAnio: mapear(anio),
    porMes: mapear(mes),
  };
}

// =============================================================================
// Ranking
// =============================================================================

export type FilaRankingCompleto = {
  posicion: number;
  supplierId: string;
  ruc: string;
  nombre: string;
  slug: string;
  ordenes: number;
  anuladas: number;
  registrado: string;
  anulado: string;
  considerado: string;
  peso: number;
};

/**
 * Ranking de proveedores por monto considerado, con filtros.
 *
 * El pliego pide separar RUC 10 y RUC 20 (sección 15): aquí llega ya filtrado, y
 * la posición se calcula sobre el conjunto filtrado, no sobre el total global.
 * Si no fuera así, filtrar por RUC 20 mostraría posiciones 1, 4, 7… sin sentido.
 */
export async function rankingCompleto(
  filtros: Filtros,
): Promise<ResultadoPaginado<FilaRankingCompleto>> {
  const texto = filtros.texto ?? '';
  const tipoRuc = filtros.tipoRuc ?? '';
  // Mismo patrón que los demás filtros: cadena vacía significa «sin filtrar».
  const gestion = filtros.gestionId ?? '';

  const [conteo, filas] = await Promise.all([
    prisma.$queryRaw<Array<{ n: number }>>`
      SELECT COUNT(DISTINCT s.id)::int AS n
      FROM "Supplier" s JOIN "CurrentOrder" o ON o."supplierId" = s.id
      WHERE (${texto} = '' OR s.name ILIKE '%' || ${texto} || '%' OR s.ruc LIKE '%' || ${texto} || '%')
        AND (${tipoRuc} = '' OR s."rucPrefix" = ${tipoRuc})
        AND (${gestion} = '' OR o."managementPeriodId" = ${gestion})
    `,
    prisma.$queryRaw<
      Array<{
        id: string;
        ruc: string;
        name: string;
        slug: string;
        ordenes: number;
        anuladas: number;
        registrado: string;
        anulado: string;
        considerado: string;
        total_considerado: string;
      }>
    >`
      SELECT
        s.id,
        s.ruc,
        s.name,
        s.slug,
        COUNT(o.id)::int AS ordenes,
        COUNT(o.id) FILTER (WHERE o."isCancelled" = true)::int AS anuladas,
        COALESCE(SUM(o.amount), 0)::text AS registrado,
        COALESCE(SUM(o.amount) FILTER (WHERE o."isCancelled" = true), 0)::text AS anulado,
        COALESCE(
          SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true),
          0
        )::text AS considerado,
        COALESCE(
          SUM(SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true)) OVER (),
          0
        )::text AS total_considerado
      FROM "Supplier" s
      JOIN "CurrentOrder" o ON o."supplierId" = s.id
      LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
      WHERE (${texto} = '' OR s.name ILIKE '%' || ${texto} || '%' OR s.ruc LIKE '%' || ${texto} || '%')
        AND (${tipoRuc} = '' OR s."rucPrefix" = ${tipoRuc})
        AND (${gestion} = '' OR o."managementPeriodId" = ${gestion})
      GROUP BY s.id, s.ruc, s.name, s.slug
      ORDER BY COALESCE(
        SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true),
        0
      ) DESC, s.name ASC
      LIMIT ${filtros.porPagina} OFFSET ${(filtros.pagina - 1) * filtros.porPagina}
    `,
  ]);

  const total = conteo[0]?.n ?? 0;
  const totalConsiderado = Number(filas[0]?.total_considerado ?? 0);
  const desplazamiento = (filtros.pagina - 1) * filtros.porPagina;

  return {
    filas: filas.map((fila, indice) => ({
      posicion: desplazamiento + indice + 1,
      supplierId: fila.id,
      ruc: fila.ruc,
      nombre: fila.name,
      slug: fila.slug,
      ordenes: aNumero(fila.ordenes),
      anuladas: aNumero(fila.anuladas),
      registrado: aDecimal2(fila.registrado),
      anulado: aDecimal2(fila.anulado),
      considerado: aDecimal2(fila.considerado),
      peso: porcentaje(Number(fila.considerado), totalConsiderado),
    })),
    total,
    pagina: filtros.pagina,
    porPagina: filtros.porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / filtros.porPagina)),
  };
}

// =============================================================================
// Historial por gestiones
// =============================================================================

export type FilaMultiGestion = {
  supplierId: string;
  ruc: string;
  nombre: string;
  slug: string;
  gestiones: number;
  detalle: { gestion: string; ordenes: number; considerado: string }[];
  totalConsiderado: string;
};

/**
 * Proveedores que aparecen en más de una gestión.
 *
 * Es el objetivo de `/historial` según la sección 18 del pliego: detectar quién
 * ha trabajado con la entidad a lo largo de varios periodos de gobierno.
 *
 * Con un único libro cargado no devuelve nada, y eso es correcto: no hay ningún
 * proveedor que aparezca en dos gestiones todavía.
 */
export async function proveedoresMultiGestion(
  minimoGestiones = 2,
): Promise<{ filas: FilaMultiGestion[]; maximoGestiones: number; totalProveedores: number }> {
  const [filas, resumen] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        id: string;
        ruc: string;
        name: string;
        slug: string;
        gestiones: number;
        detalle: { gestion: string; ordenes: number; considerado: string }[];
        total: string;
      }>
    >`
      SELECT
        s.id,
        s.ruc,
        s.name,
        s.slug,
        COUNT(DISTINCT sub."managementPeriodId")::int AS gestiones,
        json_agg(
          json_build_object(
            'gestion', g.name,
            'ordenes', sub.ordenes,
            'considerado', sub.considerado::text
          )
          ORDER BY g.name
        ) AS detalle,
        SUM(sub.considerado)::text AS total
      FROM "Supplier" s
      JOIN (
        SELECT
          o."supplierId",
          o."managementPeriodId",
          COUNT(*)::int AS ordenes,
          COALESCE(
            SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true),
            0
          ) AS considerado
        FROM "CurrentOrder" o
        LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
        WHERE o."managementPeriodId" IS NOT NULL
        GROUP BY o."supplierId", o."managementPeriodId"
      ) sub ON sub."supplierId" = s.id
      JOIN "ManagementPeriod" g ON g.id = sub."managementPeriodId"
      GROUP BY s.id, s.ruc, s.name, s.slug
      HAVING COUNT(DISTINCT sub."managementPeriodId") >= ${minimoGestiones}
      ORDER BY SUM(sub.considerado) DESC
    `,
    prisma.$queryRaw<Array<{ maximo: number; total: number }>>`
      SELECT
        COALESCE(MAX(gestiones), 0)::int AS maximo,
        COUNT(*)::int AS total
      FROM (
        SELECT o."supplierId", COUNT(DISTINCT o."managementPeriodId") AS gestiones
        FROM "CurrentOrder" o
        WHERE o."managementPeriodId" IS NOT NULL
        GROUP BY o."supplierId"
      ) x
    `,
  ]);

  return {
    filas: filas.map((fila) => ({
      supplierId: fila.id,
      ruc: fila.ruc,
      nombre: fila.name,
      slug: fila.slug,
      gestiones: aNumero(fila.gestiones),
      detalle: (fila.detalle ?? []).map((d) => ({
        gestion: d.gestion,
        ordenes: aNumero(d.ordenes),
        considerado: aDecimal2(d.considerado),
      })),
      totalConsiderado: aDecimal2(fila.total),
    })),
    maximoGestiones: aNumero(resumen[0]?.maximo),
    totalProveedores: aNumero(resumen[0]?.total),
  };
}
