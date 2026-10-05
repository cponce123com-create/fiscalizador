import { normalizeSupplierName, slugify } from '@/services/normalization';
import type { ClienteDb } from '@/services/auditService';

/**
 * Alta y mantenimiento de proveedores.
 *
 * Reglas del pliego que se respetan aquí (secciones 9, 10 y 11):
 *   - El RUC es el identificador principal, no la razón social.
 *   - Cuando el mismo RUC llega con una razón social distinta, se registra una
 *     VARIANTE y se deja en PENDING. Nunca se fusiona ni se renombra solo.
 *   - El tipo de proveedor se infiere del prefijo del RUC, pero un prefijo
 *     inesperado se marca OTRO en lugar de forzar una clasificación falsa.
 */

export type ProveedorResuelto = {
  supplierId: string;
  /** El proveedor ya existía antes de esta importación. */
  existia: boolean;
  /** La razón social entrante difiere de la registrada. */
  varianteDetectada: boolean;
};

function tipoDesdeRuc(ruc: string): 'PERSONA_NATURAL' | 'PERSONA_JURIDICA' | 'OTRO' | 'DESCONOCIDO' {
  if (ruc.startsWith('10')) return 'PERSONA_NATURAL';
  if (ruc.startsWith('20')) return 'PERSONA_JURIDICA';
  if (/^[0-9]{11}$/.test(ruc)) return 'OTRO';
  return 'DESCONOCIDO';
}

/**
 * Genera un slug único a partir del nombre.
 *
 * Dos proveedores distintos pueden compartir razón social (o quedarse sin ella
 * al normalizar), así que se añade un sufijo incremental. El slug es solo para
 * URLs; el identificador real sigue siendo el RUC.
 */
async function slugUnico(db: ClienteDb, nombre: string, ruc: string): Promise<string> {
  const base = slugify(nombre) || `proveedor-${ruc}`;
  let candidato = base;

  for (let intento = 1; intento <= 50; intento++) {
    const ocupado = await db.supplier.findUnique({
      where: { slug: candidato },
      select: { id: true },
    });
    if (!ocupado) return candidato;
    candidato = `${base}-${intento + 1}`;
  }

  // Salida de emergencia: el RUC garantiza unicidad.
  return `${base}-${ruc}`;
}

/**
 * Resuelve el proveedor de una orden, creándolo si es la primera vez que
 * aparece su RUC.
 *
 * Devuelve también si se detectó una variante de razón social, para poder
 * informarlo en el resumen de la importación.
 */
export async function resolverProveedor(
  db: ClienteDb,
  entrada: { ruc: string; name: string | null; fechaVista?: Date | null },
): Promise<ProveedorResuelto> {
  const { ruc } = entrada;
  const nombre = (entrada.name ?? '').trim();
  const nombreNormalizado = normalizeSupplierName(nombre);
  const fecha = entrada.fechaVista ?? null;

  const existente = await db.supplier.findUnique({ where: { ruc } });

  if (!existente) {
    const slug = await slugUnico(db, nombre, ruc);

    const creado = await db.supplier.create({
      data: {
        ruc,
        // Si el libro no trae razón social, se deja el RUC como nombre visible
        // en lugar de un texto inventado.
        name: nombre || ruc,
        normalizedName: nombreNormalizado || ruc,
        slug,
        supplierType: tipoDesdeRuc(ruc),
        rucPrefix: ruc.slice(0, 2),
        firstSeenAt: fecha,
        lastSeenAt: fecha,
      },
      select: { id: true },
    });

    return { supplierId: creado.id, existia: false, varianteDetectada: false };
  }

  let varianteDetectada = false;

  if (nombreNormalizado && nombreNormalizado !== existente.normalizedName) {
    varianteDetectada = true;

    // Se registra la variante como alias en PENDING. NO se renombra el
    // proveedor ni se fusiona nada: eso lo decide un administrador.
    await db.supplierAlias.upsert({
      where: {
        supplierId_normalizedName: { supplierId: existente.id, normalizedName: nombreNormalizado },
      },
      update: {},
      create: {
        supplierId: existente.id,
        name: nombre,
        normalizedName: nombreNormalizado,
        source: 'IMPORT',
        decision: 'PENDING',
      },
    });
  }

  // Se amplía la ventana temporal observada, sin tocar el nombre registrado.
  const primera = existente.firstSeenAt;
  const ultima = existente.lastSeenAt;

  await db.supplier.update({
    where: { id: existente.id },
    data: {
      firstSeenAt: fecha && (!primera || fecha < primera) ? fecha : primera,
      lastSeenAt: fecha && (!ultima || fecha > ultima) ? fecha : ultima,
    },
  });

  return { supplierId: existente.id, existia: true, varianteDetectada };
}

/**
 * Recalcula el resumen de un proveedor dentro de una gestión.
 *
 * Se recalcula desde las órdenes reales en lugar de incrementar contadores:
 * así el agregado no se desvía si una importación se reintenta o si el catálogo
 * de estados cambia.
 *
 * El monto considerado excluye las órdenes anuladas Y las de estados que el
 * catálogo marca como "no cuentan económicamente" (secciones 14 y 31).
 */
export async function recalcularResumenGestion(
  db: ClienteDb,
  supplierId: string,
  managementPeriodId: string,
): Promise<void> {
  const base = { supplierId, managementPeriodId };

  const [total, anulado, considerado, fechas] = await Promise.all([
    db.order.aggregate({
      where: base,
      _count: { _all: true },
      _sum: { amount: true },
    }),
    db.order.aggregate({
      where: { ...base, isCancelled: true },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    db.order.aggregate({
      where: { ...base, isCancelled: false, status: { countsEconomically: true } },
      _sum: { amount: true },
    }),
    db.order.aggregate({
      where: base,
      _min: { issueDate: true },
      _max: { issueDate: true },
    }),
  ]);

  const totalAmount = total._sum.amount ?? '0';
  const cancelledAmount = anulado._sum.amount ?? '0';
  const consideredAmount = considerado._sum.amount ?? '0';

  await db.supplierManagementSummary.upsert({
    where: {
      supplierId_managementPeriodId: { supplierId, managementPeriodId },
    },
    update: {
      orderCount: total._count._all,
      cancelledCount: anulado._count._all,
      totalAmount,
      cancelledAmount,
      consideredAmount,
      firstIssueDate: fechas._min.issueDate,
      lastIssueDate: fechas._max.issueDate,
    },
    create: {
      supplierId,
      managementPeriodId,
      orderCount: total._count._all,
      cancelledCount: anulado._count._all,
      totalAmount,
      cancelledAmount,
      consideredAmount,
      firstIssueDate: fechas._min.issueDate,
      lastIssueDate: fechas._max.issueDate,
    },
  });
}
