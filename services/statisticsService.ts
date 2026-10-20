Warning: truncated output (original token count: 14364)
Total output lines: 1516

import { buscarNombreProveedor } from '@/lib/busqueda-nombres';
import { coincideProveedor } from '@/lib/busqueda-nombres-sql';
import { palabrasBusqueda, gruposBusquedaOrdenes, paginasPorGrupo } from '@/lib/busqueda-ordenes';
import { Prisma } from '@/lib/generated/prisma/client';
import { type Filtros, rangoDeFechas } from '@/lib/filtros';
import { prisma } from '@/lib/prisma';
import { decimalMonetario } from '@/lib/decimal';
import { MUNICIPALIDAD_DEFAULT_ID } from '@/lib/municipalidad';
import { idMunicipalidadDesdeSlug } from '@/services/municipalityService';
import { configuracionComparacion } from '@/services/statisticsModeService';

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

export async function resumenGeneral(municipalityId = MUNICIPALIDAD_DEFAULT_ID): Promise<ResumenGeneral> {
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
    prisma.order.count({ where: { municipalityId, importBatch: { isCurrent: true } } }),
    prisma.order.count({ where: { municipalityId, isCancelled: true, importBatch: { isCurrent: true } } }),
    prisma.supplier.count({ where: { orders: { some: { municipalityId, importBatch: { isCurrent: true } } } } }),
    prisma.supplier.count({ where: { rucPrefix: '10', orders: { some: { municipalityId, importBatch: { isCurrent: true } } } } }),
    prisma.supplier.count({ where: { rucPrefix: '20', orders: { some: { municipalityId, importBatch: { isCurrent: true } } } } }),
    prisma.order.aggregate({ where: { municipalityId, importBatch: { isCurrent: true } }, _sum: { amount: true } }),
    prisma.order.aggregate({ where: { municipalityId, isCancelled: true, importBatch: { isCurrent: true } }, _sum: { amount: true } }),
    // El monto considerado excluye las anuladas Y los estados que el catálogo marca
    // como que no cuentan económicamente.
    prisma.order.aggregate({
      where: { municipalityId, isCancelled: false, status: { countsEconomically: true }, importBatch: { isCurrent: true } },
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
      WHERE "isCurrent" = true AND "municipalityId" = ${municipalityId}
    `,
    prisma.supplierManagementSummary.groupBy({ by: ['managementPeriodId'], where: { municipalityId, orderCount: { gt: 0 } } }),
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
 * Agrupa órdenes vigentes por proveedor dentro de la gestión seleccionada. Sin
 * filtro (o con «todas») combina las gestiones; el peso usa el mismo conjunto.
 */
export async function rankingProveedores(
  limite = 15,
  gestionId: string | null = null,
  tipoRuc: '10' | '20' | null = null,
  municipalityId = MUNICIPALIDAD_DEFAULT_ID,
): Promise<FilaRanking[]> {
  const gestion = gestionId === 'todas' ? '' : gestionId ?? '';
  const tipo = tipoRuc ?? '';
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
        THEN '/api/public/proveedores/' || s.id || '/foto?v=' || (SELECT floor(extract(epoch FROM p."updatedAt") * 1000)::bigint::text FROM "SupplierProfile" p WHERE p."supplierId" = s.id)
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
    WHERE o."municipalityId" = ${municipalityId}
      AND (${gestion} = '' OR o."managementPeriodId" = ${gestion})
      AND (${tipo} = '' OR left(s.ruc, 2) = ${tipo})
    GROUP BY s.id, s.ruc, s.name, s.slug
    ORDER BY COALESCE(
      SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true),
      0
    ) DESC, s.name ASC
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
async function seriePorPeriodo(
  formato: 'YYYY-MM' | 'YYYY',
  municipalityId = MUNICIPALIDAD_DEFAULT_ID,
): Promise<PuntoEvolucion[]> {
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
    WHERE o."issueDate" IS NOT NULL AND o."municipalityId" = ${municipalityId}
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

export function evolucionMensual(municipalityId = MUNICIPALIDAD_DEFAULT_ID): Promise<PuntoEvolucion[]> {
  return seriePorPeriodo('YYYY-MM', municipalityId);
}

export function evolucionAnual(municipalityId = MUNICIPALIDAD_DEFAULT_ID): Promise<PuntoEvolucion[]> {
  return seriePorPeriodo('YYYY', municipalityId);
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

export async function gastoPorGestion(municipalityId = MUNICIPALIDAD_DEFAULT_ID): Promise<FilaGestion[]> {
  const configuracion = await configuracionComparacion(municipalityId);
  if (configuracion.modo === 'ROLLING_YEARS') {
    const filas = await prisma.$queryRaw<Array<{ gestion: string; ordenes: number; proveedores: number; considerado: string }>>`
      WITH anios AS (SELECT y::int AS anio FROM generate_series(
        EXTRACT(YEAR FROM CURRENT_DATE)::int - ${configuracion.anios} + 1,
        EXTRACT(YEAR FROM CURRENT_DATE)::int
      ) y)
      SELECT a.anio::text AS gestion, COUNT(o.id)::int AS ordenes,
        COUNT(DISTINCT o."supplierId")::int AS proveedores,
        COALESCE(SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true), 0)::text AS considerado
      FROM anios a LEFT JOIN "CurrentOrder" o ON o."municipalityId" = ${municipalityId}
        AND o."issueDate" >= make_date(a.anio, 1, 1) AND o."issueDate" < make_date(a.anio + 1, 1, 1)
      LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
      GROUP BY a.anio ORDER BY a.anio
    `;
    return filas.map(fila => ({ gestion: fila.gestion, ordenes: aNumero(fila.ordenes), proveedores: aNumero(fila.proveedores), considerado: aDecimal2(fila.considerado) }));
  }
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
    LEFT JOIN "CurrentOrder" o ON o."managementPeriodId" = g.id AND o."municipalityId" = ${municipalityId}
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
export async function comparativaPorGestion(municipalityId = MUNICIPALIDAD_DEFAULT_ID): Promise<FilaComparativa[]> {
  const configuracion = await configuracionComparacion(municipalityId);
  if (configuracion.modo === 'ROLLING_YEARS') {
    const filas = await prisma.$queryRaw<Array<{ gestion: string; ordenes: number; anuladas: number; proveedores: number; registrado: string; anulado: string; considerado: string; promedio: string }>>`
      WITH anios AS (SELECT y::int AS anio FROM generate_series(
        EXTRACT(YEAR FROM CURRENT_DATE)::int - ${configuracion.anios} + 1,
        EXTRACT(YEAR FROM CURRENT_DATE)::int
      ) y)
      SELECT a.anio::text AS gestion, COUNT(o.id)::int AS ordenes,
        COUNT(o.id) FILTER (WHERE o."isCancelled" = true)::int AS anuladas,
        COUNT(DISTINCT o."supplierId")::int AS proveedores, COALESCE(SUM(o.amount), 0)::text AS registrado,
        COALESCE(SUM(o.amount) FILTER (WHERE o."isCancelled" = true), 0)::text AS anulado,
        COALESCE(SUM(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true), 0)::text AS considerado,
        COALESCE(AVG(o.amount) FILTER (WHERE o."isCancelled" = false AND st."countsEconomically" = true), 0)::text AS promedio
      FROM anios a LEFT JOIN "CurrentOrder" o ON o."municipalityId" = ${municipalityId}
        AND o."issueDate" >= make_date(a.anio, 1, 1) AND o."issueDate" < make_date(a.anio + 1, 1, 1)
      LEFT JOIN "OrderStatus" st ON st.id = o."statusId"
      GROUP BY a.anio ORDER BY a.anio
    `;
    const total = filas.reduce((acumulado, fila) => acumulado + Number(fila.considerado), 0);
    return filas.map(fila => {
      const considerado = aDecimal2(fila.considerado);
      return { gestion: fila.gestion, ordenes: aNumero(fila.ordenes), anuladas: aNumero(fila.anuladas), proveedores: aNumero(fila.proveedores), registrado: aDecimal2(fila.registrado), anulado: aDecimal2(fila.anulado), considerado, peso: porcentaje(Number(considerado), total), ticketMedio: aDecimal2(fila.promedio) };
    });
  }
  const …6364 tokens truncated…);
  const texto = filtros.texto ?? '';
  const tipoRuc = filtros.tipoRuc ?? '';
  const palabras = palabrasBusqueda(texto);
  const nombreNormalizado = Prisma.sql`translate(lower(s.name), 'áéíóúüñ', 'aeiouun')`;
  const frase = palabras.join(' ');
  const coincide = coincideProveedor(texto);
  const relevancia = Prisma.sql`CASE
    WHEN ${nombreNormalizado} = ${frase} OR s.ruc = ${texto} THEN 0
    WHEN ${palabras.length} > 0 AND NOT EXISTS (
      SELECT 1 FROM unnest(${palabras}::text[]) AS buscada(palabra)
      WHERE strpos(' ' || regexp_replace(${nombreNormalizado}, '[^a-z0-9]+', ' ', 'g') || ' ', ' ' || buscada.palabra || ' ') = 0
    ) THEN 1 ELSE 2 END`;

  const [conteo, filas] = await Promise.all([
    prisma.$queryRaw<Array<{ n: number }>>`
      SELECT COUNT(DISTINCT s.id)::int AS n
      FROM "Supplier" s JOIN "CurrentOrder" o ON o."supplierId" = s.id
      WHERE ${coincide}
        AND o."municipalityId" = ${municipalityId}
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
      WHERE ${coincide}
        AND o."municipalityId" = ${municipalityId}
        AND (${tipoRuc} = '' OR s."rucPrefix" = ${tipoRuc})
      GROUP BY s.id, s.ruc, s.name, s.slug, s."supplierType"
      ORDER BY ${filtros.orden === 'relevancia' && texto ? relevancia : Prisma.sql`0 + 0`}, s.name ASC, s.id ASC
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
export async function perfilProveedor(slug: string, municipalityId = MUNICIPALIDAD_DEFAULT_ID): Promise<PerfilProveedor | null> {
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
      WHERE o."supplierId" = ${proveedor.id} AND o."municipalityId" = ${municipalityId}
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
      WHERE o."supplierId" = ${proveedor.id} AND o."municipalityId" = ${municipalityId}
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
      WHERE o."supplierId" = ${proveedor.id} AND o."municipalityId" = ${municipalityId} AND o."issueDate" IS NOT NULL
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
      WHERE o."supplierId" = ${proveedor.id} AND o."municipalityId" = ${municipalityId} AND o."issueDate" IS NOT NULL
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
  fotoUrl?: string | null;
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
  const municipalityId = await idMunicipalidadDesdeSlug(filtros.municipalidadSlug);
  const texto = filtros.texto ?? '';
  const tipoRuc = filtros.tipoRuc ?? '';
  // Mismo patrón que los demás filtros: cadena vacía significa «sin filtrar».
  const gestion = filtros.gestionId === 'todas' ? '' : filtros.gestionId ?? '';

  const [conteo, filas] = await Promise.all([
    prisma.$queryRaw<Array<{ n: number }>>`
      SELECT COUNT(DISTINCT s.id)::int AS n
      FROM "Supplier" s JOIN "CurrentOrder" o ON o."supplierId" = s.id
      WHERE ${coincideProveedor(texto)}
        AND o."municipalityId" = ${municipalityId}
        AND (${tipoRuc} = '' OR left(s.ruc, 2) = ${tipoRuc})
        AND (${gestion} = '' OR o."managementPeriodId" = ${gestion})
    `,
    prisma.$queryRaw<
      Array<{
        id: string;
        ruc: string;
        name: string;
        slug: string;
        photoUrl: string | null;
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
        CASE WHEN EXISTS (SELECT 1 FROM "SupplierProfile" p WHERE p."supplierId" = s.id AND p."photoKey" IS NOT NULL AND p."isPublic" = true AND p.publication->'foto'->>'enabled' = 'true' AND p.publication->'foto'->>'verifiedAt' IS NOT NULL)
          THEN '/api/public/proveedores/' || s.id || '/foto?v=' || (SELECT floor(extract(epoch FROM p."updatedAt") * 1000)::bigint::text FROM "SupplierProfile" p WHERE p."supplierId" = s.id)
          ELSE NULL END AS "photoUrl",
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
      WHERE ${coincideProveedor(texto)}
        AND o."municipalityId" = ${municipalityId}
        AND (${tipoRuc} = '' OR left(s.ruc, 2) = ${tipoRuc})
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
      fotoUrl: fila.photoUrl ?? null,
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
