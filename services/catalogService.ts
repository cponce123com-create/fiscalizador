import { ErrorDeNegocio, NoEncontrado } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { contextoDePeticion, registrarAuditoria } from '@/services/auditService';
import { normalizeKey } from '@/services/normalization';

/**
 * Catálogos configurables: estados, tipos de orden, tipos de contratación y gestiones.
 *
 * Son DATOS, no lógica (docs/prompt.md secciones 14 y 31): clasificar un estado nuevo
 * —decidir si cuenta como gasto— no puede exigir un despliegue. El importador solo los
 * lee (`cargarCatalogos`), y solo reconoce los que están ACTIVOS: desactivar una entrada
 * no toca nada de lo ya importado, pero deja de reconocerla en los libros siguientes.
 *
 * Dos reglas se repiten en los cuatro catálogos:
 *
 * - El código se normaliza, porque es la clave con la que el importador reconoce lo que
 *   dice el libro. Cambiarlo no altera lo ya importado: las órdenes apuntan al
 *   identificador, no al código.
 * - Nada se elimina si está en uso. Las órdenes apuntan a estos catálogos con clave
 *   foránea, así que en lugar de dejar que falle la base de datos se explica cuántas
 *   órdenes lo usan y se ofrece desactivarlo.
 *
 * Todo cambio queda auditado con el antes y el después, porque estos catálogos deciden
 * qué suma al gasto publicado.
 */

export type ContextoAccion = {
  userId: string | null;
  request?: Request;
};

function contextoDeAuditoria(accion: ContextoAccion) {
  return accion.request ? contextoDePeticion(accion.request) : { ip: null, userAgent: null };
}

/** Normaliza un código: MAYÚSCULAS_CON_GUIONES. */
function normalizarCodigo(valor: string): string {
  return valor
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Normaliza los alias con la MISMA función que usa el importador para leer el libro
 * (`normalizeKey`). Si se guardaran de otra forma, un alias parecería correcto en el
 * panel y no coincidiría nunca al importar.
 */
function normalizarAlias(valores: readonly string[]): string[] {
  const vistos = new Set<string>();

  for (const valor of valores) {
    const alias = normalizeKey(valor);
    if (alias !== '') vistos.add(alias);
  }

  return [...vistos];
}

// =============================================================================
// Estados
// =============================================================================

export type EstadoCatalogo = {
  id: string;
  code: string;
  label: string;
  aliases: string[];
  countsEconomically: boolean;
  isCancelled: boolean;
  isUnknown: boolean;
  position: number;
  isActive: boolean;
  /** Órdenes que lo usan. Con más de cero, no se puede eliminar. */
  ordenes: number;
};

export async function listarEstados(): Promise<EstadoCatalogo[]> {
  const estados = await prisma.orderStatus.findMany({
    orderBy: [{ position: 'asc' }, { label: 'asc' }],
    select: {
      id: true,
      code: true,
      label: true,
      aliases: true,
      countsEconomically: true,
      isCancelled: true,
      isUnknown: true,
      position: true,
      isActive: true,
      _count: { select: { orders: true } },
    },
  });

  return estados.map((estado) => ({
    id: estado.id,
    code: estado.code,
    label: estado.label,
    aliases: estado.aliases,
    countsEconomically: estado.countsEconomically,
    isCancelled: estado.isCancelled,
    isUnknown: estado.isUnknown,
    position: estado.position,
    isActive: estado.isActive,
    ordenes: estado._count.orders,
  }));
}

export type EntradaEstado = {
  code: string;
  label: string;
  aliases: string[];
  countsEconomically: boolean;
  isCancelled: boolean;
  isUnknown: boolean;
  position: number;
  isActive: boolean;
};

function validarEstado(entrada: EntradaEstado): EntradaEstado {
  const code = normalizarCodigo(entrada.code);
  const label = entrada.label.trim();

  if (code === '') {
    throw new ErrorDeNegocio('El código del estado es obligatorio (letras y números).');
  }
  if (label === '') {
    throw new ErrorDeNegocio('El nombre del estado es obligatorio.');
  }
  if (entrada.isCancelled && entrada.countsEconomically) {
    throw new ErrorDeNegocio(
      'Un estado anulado no puede contar como gasto: son excluyentes. Si suma al gasto, no es una anulación.',
    );
  }
  if (entrada.isUnknown && entrada.countsEconomically) {
    throw new ErrorDeNegocio(
      'El estado desconocido es la red de seguridad de lo que no se reconoce: no puede contar ' +
        'como gasto, o cualquier estado nuevo sumaría al monto publicado sin que nadie lo clasifique.',
    );
  }

  return { ...entrada, code, label, aliases: normalizarAlias(entrada.aliases) };
}

/** Solo puede haber un estado marcado como desconocido: es el que recoge lo no reconocido. */
async function comprobarUnicoDesconocido(entrada: EntradaEstado, exceptoId?: string): Promise<void> {
  if (!entrada.isUnknown) return;

  const otro = await prisma.orderStatus.findFirst({
    where: { isUnknown: true, id: exceptoId ? { not: exceptoId } : undefined },
    select: { label: true },
  });

  if (otro) {
    throw new ErrorDeNegocio(
      `Ya hay un estado marcado como desconocido («${otro.label}»): solo puede haber uno.`,
    );
  }
}

export async function crearEstado(
  entrada: EntradaEstado,
  accion: ContextoAccion,
): Promise<{ id: string }> {
  const datos = validarEstado(entrada);
  await comprobarUnicoDesconocido(datos);

  const duplicado = await prisma.orderStatus.findUnique({
    where: { code: datos.code },
    select: { id: true },
  });
  if (duplicado) throw new ErrorDeNegocio(`Ya existe un estado con el código ${datos.code}.`);

  const { ip, userAgent } = contextoDeAuditoria(accion);

  return prisma.$transaction(async (tx) => {
    const estado = await tx.orderStatus.create({
      data: {
        code: datos.code,
        label: datos.label,
        aliases: datos.aliases,
        countsEconomically: datos.countsEconomically,
        isCancelled: datos.isCancelled,
        isUnknown: datos.isUnknown,
        position: datos.position,
        isActive: datos.isActive,
      },
      select: { id: true },
    });

    await registrarAuditoria(tx, {
      userId: accion.userId,
      action: 'CREATE',
      entity: 'OrderStatus',
      entityId: estado.id,
      ip,
      userAgent,
      metadata: {
        code: datos.code,
        label: datos.label,
        countsEconomically: datos.countsEconomically,
        isCancelled: datos.isCancelled,
        isUnknown: datos.isUnknown,
      },
    });

    return estado;
  });
}

export async function actualizarEstado(
  id: string,
  entrada: EntradaEstado,
  accion: ContextoAccion,
): Promise<void> {
  const existente = await prisma.orderStatus.findUnique({
    where: { id },
    select: {
      code: true,
      label: true,
      countsEconomically: true,
      isCancelled: true,
      isUnknown: true,
    },
  });
  if (!existente) throw new NoEncontrado(`No existe el estado ${id}.`);

  const datos = validarEstado(entrada);
  await comprobarUnicoDesconocido(datos, id);

  const duplicado = await prisma.orderStatus.findUnique({
    where: { code: datos.code },
    select: { id: true },
  });
  if (duplicado && duplicado.id !== id) {
    throw new ErrorDeNegocio(`Ya existe un estado con el código ${datos.code}.`);
  }

  const { ip, userAgent } = contextoDeAuditoria(accion);

  await prisma.$transaction(async (tx) => {
    await tx.orderStatus.update({
      where: { id },
      data: {
        code: datos.code,
        label: datos.label,
        aliases: datos.aliases,
        countsEconomically: datos.countsEconomically,
        isCancelled: datos.isCancelled,
        isUnknown: datos.isUnknown,
        position: datos.position,
        isActive: datos.isActive,
      },
    });

    await registrarAuditoria(tx, {
      userId: accion.userId,
      action: 'UPDATE',
      entity: 'OrderStatus',
      entityId: id,
      ip,
      userAgent,
      metadata: {
        antes: {
          code: existente.code,
          label: existente.label,
          countsEconomically: existente.countsEconomically,
          isCancelled: existente.isCancelled,
          isUnknown: existente.isUnknown,
        },
        despues: {
          code: datos.code,
          label: datos.label,
          countsEconomically: datos.countsEconomically,
          isCancelled: datos.isCancelled,
          isUnknown: datos.isUnknown,
        },
      },
    });
  });
}

export async function eliminarEstado(id: string, accion: ContextoAccion): Promise<void> {
  const existente = await prisma.orderStatus.findUnique({
    where: { id },
    select: { code: true, label: true, _count: { select: { orders: true } } },
  });
  if (!existente) throw new NoEncontrado(`No existe el estado ${id}.`);

  if (existente._count.orders > 0) {
    throw new ErrorDeNegocio(
      `No se puede eliminar «${existente.label}»: ${existente._count.orders} orden(es) lo usan. ` +
        'Desactívalo si no quieres que se reconozca en las próximas importaciones: lo ya importado se conserva.',
    );
  }

  const { ip, userAgent } = contextoDeAuditoria(accion);

  await prisma.$transaction(async (tx) => {
    await tx.orderStatus.delete({ where: { id } });

    await registrarAuditoria(tx, {
      userId: accion.userId,
      action: 'DELETE',
      entity: 'OrderStatus',
      entityId: id,
      ip,
      userAgent,
      metadata: { code: existente.code, label: existente.label },
    });
  });
}

// =============================================================================
// Tipos de orden y tipos de contratación
// =============================================================================

export type TipoCatalogo = {
  id: string;
  code: string;
  label: string;
  aliases: string[];
  position: number;
  isActive: boolean;
  /** Órdenes que lo usan. Con más de cero, no se puede eliminar. */
  ordenes: number;
};

export type EntradaTipo = {
  code: string;
  label: string;
  aliases: string[];
  position: number;
  isActive: boolean;
};

function validarTipo(entrada: EntradaTipo, nombre: string): EntradaTipo {
  const code = normalizarCodigo(entrada.code);
  const label = entrada.label.trim();

  if (code === '') {
    throw new ErrorDeNegocio(`El código del ${nombre} es obligatorio (letras y números).`);
  }
  if (label === '') {
    throw new ErrorDeNegocio(`El nombre del ${nombre} es obligatorio.`);
  }

  return { ...entrada, code, label, aliases: normalizarAlias(entrada.aliases) };
}

export async function listarTiposDeOrden(): Promise<TipoCatalogo[]> {
  const tipos = await prisma.orderType.findMany({
    orderBy: [{ position: 'asc' }, { label: 'asc' }],
    select: {
      id: true,
      code: true,
      label: true,
      aliases: true,
      position: true,
      isActive: true,
      _count: { select: { orders: true } },
    },
  });

  return tipos.map((tipo) => ({
    id: tipo.id,
    code: tipo.code,
    label: tipo.label,
    aliases: tipo.aliases,
    position: tipo.position,
    isActive: tipo.isActive,
    ordenes: tipo._count.orders,
  }));
}

export async function listarTiposDeContratacion(): Promise<TipoCatalogo[]> {
  const tipos = await prisma.contractType.findMany({
    orderBy: [{ position: 'asc' }, { label: 'asc' }],
    select: {
      id: true,
      code: true,
      label: true,
      aliases: true,
      position: true,
      isActive: true,
      _count: { select: { orders: true } },
    },
  });

  return tipos.map((tipo) => ({
    id: tipo.id,
    code: tipo.code,
    label: tipo.label,
    aliases: tipo.aliases,
    position: tipo.position,
    isActive: tipo.isActive,
    ordenes: tipo._count.orders,
  }));
}

export async function crearTipoDeOrden(
  entrada: EntradaTipo,
  accion: ContextoAccion,
): Promise<{ id: string }> {
  const datos = validarTipo(entrada, 'tipo de orden');

  const duplicado = await prisma.orderType.findUnique({
    where: { code: datos.code },
    select: { id: true },
  });
  if (duplicado) throw new ErrorDeNegocio(`Ya existe un tipo de orden con el código ${datos.code}.`);

  const { ip, userAgent } = contextoDeAuditoria(accion);

  return prisma.$transaction(async (tx) => {
    const tipo = await tx.orderType.create({
      data: {
        code: datos.code,
        label: datos.label,
        aliases: datos.aliases,
        position: datos.position,
        isActive: datos.isActive,
      },
      select: { id: true },
    });

    await registrarAuditoria(tx, {
      userId: accion.userId,
      action: 'CREATE',
      entity: 'OrderType',
      entityId: tipo.id,
      ip,
      userAgent,
      metadata: { code: datos.code, label: datos.label },
    });

    return tipo;
  });
}

export async function crearTipoDeContratacion(
  entrada: EntradaTipo,
  accion: ContextoAccion,
): Promise<{ id: string }> {
  const datos = validarTipo(entrada, 'tipo de contratación');

  const duplicado = await prisma.contractType.findUnique({
    where: { code: datos.code },
    select: { id: true },
  });
  if (duplicado) {
    throw new ErrorDeNegocio(`Ya existe un tipo de contratación con el código ${datos.code}.`);
  }

  const { ip, userAgent } = contextoDeAuditoria(accion);

  return prisma.$transaction(async (tx) => {
    const tipo = await tx.contractType.create({
      data: {
        code: datos.code,
        label: datos.label,
        aliases: datos.aliases,
        position: datos.position,
        isActive: datos.isActive,
      },
      select: { id: true },
    });

    await registrarAuditoria(tx, {
      userId: accion.userId,
      action: 'CREATE',
      entity: 'ContractType',
      entityId: tipo.id,
      ip,
      userAgent,
      metadata: { code: datos.code, label: datos.label },
    });

    return tipo;
  });
}

export async function actualizarTipoDeOrden(
  id: string,
  entrada: EntradaTipo,
  accion: ContextoAccion,
): Promise<void> {
  const existente = await prisma.orderType.findUnique({
    where: { id },
    select: { code: true, label: true },
  });
  if (!existente) throw new NoEncontrado(`No existe el tipo de orden ${id}.`);

  const datos = validarTipo(entrada, 'tipo de orden');

  const duplicado = await prisma.orderType.findUnique({
    where: { code: datos.code },
    select: { id: true },
  });
  if (duplicado && duplicado.id !== id) {
    throw new ErrorDeNegocio(`Ya existe un tipo de orden con el código ${datos.code}.`);
  }

  const { ip, userAgent } = contextoDeAuditoria(accion);

  await prisma.$transaction(async (tx) => {
    await tx.orderType.update({
      where: { id },
      data: {
        code: datos.code,
        label: datos.label,
        aliases: datos.aliases,
        position: datos.position,
        isActive: datos.isActive,
      },
    });

    await registrarAuditoria(tx, {
      userId: accion.userId,
      action: 'UPDATE',
      entity: 'OrderType',
      entityId: id,
      ip,
      userAgent,
      metadata: {
        antes: { code: existente.code, label: existente.label },
        despues: { code: datos.code, label: datos.label, isActive: datos.isActive },
      },
    });
  });
}

export async function actualizarTipoDeContratacion(
  id: string,
  entrada: EntradaTipo,
  accion: ContextoAccion,
): Promise<void> {
  const existente = await prisma.contractType.findUnique({
    where: { id },
    select: { code: true, label: true },
  });
  if (!existente) throw new NoEncontrado(`No existe el tipo de contratación ${id}.`);

  const datos = validarTipo(entrada, 'tipo de contratación');

  const duplicado = await prisma.contractType.findUnique({
    where: { code: datos.code },
    select: { id: true },
  });
  if (duplicado && duplicado.id !== id) {
    throw new ErrorDeNegocio(`Ya existe un tipo de contratación con el código ${datos.code}.`);
  }

  const { ip, userAgent } = contextoDeAuditoria(accion);

  await prisma.$transaction(async (tx) => {
    await tx.contractType.update({
      where: { id },
      data: {
        code: datos.code,
        label: datos.label,
        aliases: datos.aliases,
        position: datos.position,
        isActive: datos.isActive,
      },
    });

    await registrarAuditoria(tx, {
      userId: accion.userId,
      action: 'UPDATE',
      entity: 'ContractType',
      entityId: id,
      ip,
      userAgent,
      metadata: {
        antes: { code: existente.code, label: existente.label },
        despues: { code: datos.code, label: datos.label, isActive: datos.isActive },
      },
    });
  });
}

export async function eliminarTipoDeOrden(id: string, accion: ContextoAccion): Promise<void> {
  const existente = await prisma.orderType.findUnique({
    where: { id },
    select: { code: true, label: true, _count: { select: { orders: true } } },
  });
  if (!existente) throw new NoEncontrado(`No existe el tipo de orden ${id}.`);

  if (existente._count.orders > 0) {
    throw new ErrorDeNegocio(
      `No se puede eliminar «${existente.label}»: ${existente._count.orders} orden(es) lo usan. ` +
        'Desactívalo si no quieres que se reconozca en las próximas importaciones: lo ya importado se conserva.',
    );
  }

  const { ip, userAgent } = contextoDeAuditoria(accion);

  await prisma.$transaction(async (tx) => {
    await tx.orderType.delete({ where: { id } });

    await registrarAuditoria(tx, {
      userId: accion.userId,
      action: 'DELETE',
      entity: 'OrderType',
      entityId: id,
      ip,
      userAgent,
      metadata: { code: existente.code, label: existente.label },
    });
  });
}

export async function eliminarTipoDeContratacion(id: string, accion: ContextoAccion): Promise<void> {
  const existente = await prisma.contractType.findUnique({
    where: { id },
    select: { code: true, label: true, _count: { select: { orders: true } } },
  });
  if (!existente) throw new NoEncontrado(`No existe el tipo de contratación ${id}.`);

  if (existente._count.orders > 0) {
    throw new ErrorDeNegocio(
      `No se puede eliminar «${existente.label}»: ${existente._count.orders} orden(es) lo usan. ` +
        'Desactívalo si no quieres que se reconozca en las próximas importaciones: lo ya importado se conserva.',
    );
  }

  const { ip, userAgent } = contextoDeAuditoria(accion);

  await prisma.$transaction(async (tx) => {
    await tx.contractType.delete({ where: { id } });

    await registrarAuditoria(tx, {
      userId: accion.userId,
      action: 'DELETE',
      entity: 'ContractType',
      entityId: id,
      ip,
      userAgent,
      metadata: { code: existente.code, label: existente.label },
    });
  });
}

// =============================================================================
// Gestiones
// =============================================================================

export type GestionCatalogo = {
  id: string;
  name: string;
  /** Fechas en formato `YYYY-MM-DD`, que es lo que espera un `<input type="date">`. */
  startDate: string;
  endDate: string;
  description: string | null;
  ordenes: number;
  resumenes: number;
  lotes: number;
};

export async function listarGestiones(): Promise<GestionCatalogo[]> {
  const gestiones = await prisma.managementPeriod.findMany({
    orderBy: { startDate: 'asc' },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      description: true,
      _count: { select: { orders: true, summaries: true, importBatches: true } },
    },
  });

  return gestiones.map((gestion) => ({
    id: gestion.id,
    name: gestion.name,
    startDate: gestion.startDate.toISOString().slice(0, 10),
    endDate: gestion.endDate.toISOString().slice(0, 10),
    description: gestion.description,
    ordenes: gestion._count.orders,
    resumenes: gestion._count.summaries,
    lotes: gestion._count.importBatches,
  }));
}

export type EntradaGestion = {
  name: string;
  startDate: string;
  endDate: string;
  description: string;
};

/** Convierte `YYYY-MM-DD` en la medianoche UTC que guarda la columna `date`. */
function fechaDe(texto: string, campo: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    throw new ErrorDeNegocio(`La ${campo} tiene que venir como AAAA-MM-DD.`);
  }

  const fecha = new Date(`${texto}T00:00:00.000Z`);
  if (Number.isNaN(fecha.getTime())) {
    throw new ErrorDeNegocio(`La ${campo} no es una fecha del calendario.`);
  }

  return fecha;
}

function validarGestion(entrada: EntradaGestion): {
  name: string;
  startDate: Date;
  endDate: Date;
  description: string | null;
} {
  const name = entrada.name.trim();
  if (name === '') throw new ErrorDeNegocio('El nombre de la gestión es obligatorio.');

  const startDate = fechaDe(entrada.startDate, 'fecha de inicio');
  const endDate = fechaDe(entrada.endDate, 'fecha de fin');

  if (endDate < startDate) {
    throw new ErrorDeNegocio('La gestión no puede terminar antes de empezar.');
  }

  const description = entrada.description.trim();

  return { name, startDate, endDate, description: description === '' ? null : description };
}

export async function crearGestion(
  entrada: EntradaGestion,
  accion: ContextoAccion,
): Promise<{ id: string }> {
  const datos = validarGestion(entrada);

  const duplicada = await prisma.managementPeriod.findUnique({
    where: { name: datos.name },
    select: { id: true },
  });
  if (duplicada) throw new ErrorDeNegocio(`Ya existe una gestión llamada ${datos.name}.`);

  const { ip, userAgent } = contextoDeAuditoria(accion);

  return prisma.$transaction(async (tx) => {
    const gestion = await tx.managementPeriod.create({
      data: datos,
      select: { id: true },
    });

    await registrarAuditoria(tx, {
      userId: accion.userId,
      action: 'CREATE',
      entity: 'ManagementPeriod',
      entityId: gestion.id,
      ip,
      userAgent,
      metadata: {
        name: datos.name,
        startDate: entrada.startDate,
        endDate: entrada.endDate,
      },
    });

    return gestion;
  });
}

export async function actualizarGestion(
  id: string,
  entrada: EntradaGestion,
  accion: ContextoAccion,
): Promise<void> {
  const existente = await prisma.managementPeriod.findUnique({
    where: { id },
    select: { name: true, startDate: true, endDate: true },
  });
  if (!existente) throw new NoEncontrado(`No existe la gestión ${id}.`);

  const datos = validarGestion(entrada);

  const duplicada = await prisma.managementPeriod.findUnique({
    where: { name: datos.name },
    select: { id: true },
  });
  if (duplicada && duplicada.id !== id) {
    throw new ErrorDeNegocio(`Ya existe una gestión llamada ${datos.name}.`);
  }

  const { ip, userAgent } = contextoDeAuditoria(accion);

  await prisma.$transaction(async (tx) => {
    await tx.managementPeriod.update({ where: { id }, data: datos });

    await registrarAuditoria(tx, {
      userId: accion.userId,
      action: 'UPDATE',
      entity: 'ManagementPeriod',
      entityId: id,
      ip,
      userAgent,
      metadata: {
        antes: {
          name: existente.name,
          startDate: existente.startDate.toISOString().slice(0, 10),
          endDate: existente.endDate.toISOString().slice(0, 10),
        },
        despues: { name: datos.name, startDate: entrada.startDate, endDate: entrada.endDate },
      },
    });
  });
}

export async function eliminarGestion(id: string, accion: ContextoAccion): Promise<void> {
  const existente = await prisma.managementPeriod.findUnique({
    where: { id },
    select: {
      name: true,
      _count: { select: { orders: true, summaries: true, importBatches: true } },
    },
  });
  if (!existente) throw new NoEncontrado(`No existe la gestión ${id}.`);

  const enUso =
    existente._count.orders + existente._count.summaries + existente._count.importBatches;

  if (enUso > 0) {
    throw new ErrorDeNegocio(
      `No se puede eliminar la gestión «${existente.name}»: la usan ${existente._count.orders} ` +
        `orden(es), ${existente._count.summaries} resumen(es) y ${existente._count.importBatches} ` +
        'lote(s) de importación. Si las fechas están mal, corrígelas aquí: las órdenes se ' +
        'reasignan solas a la gestión que corresponda.',
    );
  }

  const { ip, userAgent } = contextoDeAuditoria(accion);

  await prisma.$transaction(async (tx) => {
    await tx.managementPeriod.delete({ where: { id } });

    await registrarAuditoria(tx, {
      userId: accion.userId,
      action: 'DELETE',
      entity: 'ManagementPeriod',
      entityId: id,
      ip,
      userAgent,
      metadata: { name: existente.name },
    });
  });
}
