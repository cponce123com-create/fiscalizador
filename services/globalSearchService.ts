import { decimalMonetario } from '@/lib/decimal';
import { Prisma } from '@/lib/generated/prisma/client';
import type { ProveedorGlobal, ResultadoBusquedaGlobal } from '@/lib/busqueda-global';
import { palabrasBusqueda } from '@/lib/busqueda-ordenes';
import { prisma } from '@/lib/prisma';
import { normalizeSupplierName } from '@/services/normalization';

type FilaGlobal = {
  totalCoincidencias: number;
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

const CACHE_MS = 30_000;
const CACHE_MAXIMO = 100;
const cacheBusqueda = new Map<string, { vence: number; resultado: ResultadoBusquedaGlobal }>();

/** Se llama después de una importación o eliminación para no servir agregados anteriores. */
export function invalidarCacheBusquedaGlobal(): void {
  cacheBusqueda.clear();
}

function leerCache(clave: string): ResultadoBusquedaGlobal | null {
  const entrada = cacheBusqueda.get(clave);
  if (!entrada) return null;
  if (entrada.vence <= Date.now()) {
    cacheBusqueda.delete(clave);
    return null;
  }
  // Refresca el orden de uso para aplicar un LRU pequeño y acotado.
  cacheBusqueda.delete(clave);
  cacheBusqueda.set(clave, entrada);
  return entrada.resultado;
}

function guardarCache(clave: string, resultado: ResultadoBusquedaGlobal): void {
  if (cacheBusqueda.size >= CACHE_MAXIMO) {
    const masAntigua = cacheBusqueda.keys().next().value;
    if (masAntigua) cacheBusqueda.delete(masAntigua);
  }
  cacheBusqueda.set(clave, { vence: Date.now() + CACHE_MS, resultado });
}

/**
 * Busca sobre Supplier —que sí posee índices trigram— y suma desde el agregado
 * SupplierManagementSummary. Así no recorre CurrentOrder dos veces por cada
 * tecla escrita. El orden favorece identidad exacta antes que popularidad.
 */
export async function buscarProveedoresGlobal(texto: string): Promise<ResultadoBusquedaGlobal> {
  const termino = texto.trim().replace(/\s+/g, ' ').slice(0, 120);
  if (termino.length < 3) return { totalProveedores: 0, proveedores: [] };

  const normalizado = normalizeSupplierName(termino);
  const claveCache = normalizado.toLocaleLowerCase('es-PE');
  const almacenado = leerCache(claveCache);
  if (almacenado) return almacenado;
  const palabras = palabrasBusqueda(termino).map(palabra => palabra.toUpperCase());
  const digitos = termino.replace(/\D/g, '');
  const contieneFrase = `%${normalizado}%`;
  const empiezaFrase = `${normalizado}%`;
  const contieneRuc = digitos.length >= 3 ? `%${digitos}%` : '__SIN_RUC__';
  const todasLasPalabras = palabras.length
    ? Prisma.sql`(${Prisma.join(palabras.map(palabra => Prisma.sql`s."normalizedName" ILIKE ${`%${palabra}%`}`), ' AND ')})`
    : Prisma.sql`false`;

  const filas = await prisma.$queryRaw<FilaGlobal[]>`
    WITH candidatos AS MATERIALIZED (
      SELECT s.id, s.name,
        CASE
          WHEN s.ruc = ${digitos} OR s."normalizedName" = ${normalizado} THEN 0
          WHEN s."normalizedName" ILIKE ${empiezaFrase} THEN 1
          WHEN s."normalizedName" ILIKE ${contieneFrase} THEN 2
          WHEN s.ruc LIKE ${contieneRuc} THEN 3
          ELSE 4
        END AS relevancia
      FROM "Supplier" s
      WHERE (
        s."normalizedName" ILIKE ${contieneFrase}
        OR s.ruc LIKE ${contieneRuc}
        OR ${todasLasPalabras}
      )
      AND EXISTS (
        SELECT 1
        FROM "SupplierManagementSummary" resumen
        JOIN "Municipality" activa ON activa.id = resumen."municipalityId" AND activa."isActive" = true
        WHERE resumen."supplierId" = s.id
      )
    ), seleccionados AS MATERIALIZED (
      SELECT c.*, COUNT(*) OVER()::int AS "totalCoincidencias"
      FROM candidatos c
      ORDER BY c.relevancia, c.name
      LIMIT 8
    )
    SELECT c."totalCoincidencias", s.id AS "supplierId", s.name AS "supplierName",
           s.ruc, s.slug AS "supplierSlug", m.id AS "municipalityId",
           m.slug AS "municipalitySlug", m."shortName" AS "municipalityName",
           g.name AS "periodName", resumen."orderCount"::int AS ordenes,
           resumen."consideredAmount"::text AS considerado
    FROM seleccionados c
    JOIN "Supplier" s ON s.id = c.id
    JOIN "SupplierManagementSummary" resumen ON resumen."supplierId" = s.id
    JOIN "Municipality" m ON m.id = resumen."municipalityId" AND m."isActive" = true
    JOIN "ManagementPeriod" g ON g.id = resumen."managementPeriodId"
    ORDER BY c.relevancia, s.name, m."shortName", g."startDate"
  `;

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

  const resultado = { totalProveedores: filas[0]?.totalCoincidencias ?? 0, proveedores: [...mapa.values()] };
  guardarCache(claveCache, resultado);
  return resultado;
}
