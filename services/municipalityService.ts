import { MUNICIPALIDAD_DEFAULT_ID, MUNICIPALIDAD_DEFAULT_SLUG, type MunicipalidadActiva } from '@/lib/municipalidad';
import { prisma } from '@/lib/prisma';
import { ErrorDeNegocio, NoEncontrado } from '@/lib/errors';
import { slugify } from '@/services/normalization';
import { registrarAuditoria } from '@/services/auditService';

export async function municipalidadPorDefecto(): Promise<MunicipalidadActiva> {
  const entidad =
    (await prisma.municipality.findFirst({
      where: { isDefault: true, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, slug: true, name: true, shortName: true, ruc: true, province: true, department: true, entityType: true },
    })) ??
    (await prisma.municipality.findUnique({
      where: { id: MUNICIPALIDAD_DEFAULT_ID },
      select: { id: true, slug: true, name: true, shortName: true, ruc: true, province: true, department: true, entityType: true },
    }));

  return {
    id: entidad?.id ?? MUNICIPALIDAD_DEFAULT_ID,
    slug: entidad?.slug ?? MUNICIPALIDAD_DEFAULT_SLUG,
    nombre: entidad?.name ?? 'Municipalidad Distrital de San Ramón',
    nombreCorto: entidad?.shortName ?? 'San Ramón',
    ruc: entidad?.ruc ?? '20146657142',
    provincia: entidad?.province ?? 'Chanchamayo',
    departamento: entidad?.department ?? 'Junín',
    tipoEntidad: entidad?.entityType ?? 'DISTRITAL',
  };
}

export async function listarMunicipalidadesActivas(): Promise<MunicipalidadActiva[]> {
  const entidades = await prisma.municipality.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    select: { id: true, slug: true, name: true, shortName: true, ruc: true, province: true, department: true, entityType: true },
  });

  if (entidades.length === 0) return [await municipalidadPorDefecto()];

  return entidades.map((entidad) => ({
    id: entidad.id,
    slug: entidad.slug,
    nombre: entidad.name,
    nombreCorto: entidad.shortName,
    ruc: entidad.ruc,
    provincia: entidad.province,
    departamento: entidad.department,
    tipoEntidad: entidad.entityType,
  }));
}

export async function municipalidadActivaDesdeSlug(slug: string | null | undefined): Promise<MunicipalidadActiva> {
  if (!slug || slug === MUNICIPALIDAD_DEFAULT_SLUG) return municipalidadPorDefecto();

  const entidad = await prisma.municipality.findFirst({
    where: { slug, isActive: true },
    select: { id: true, slug: true, name: true, shortName: true, ruc: true, province: true, department: true, entityType: true },
  });

  if (!entidad) return municipalidadPorDefecto();
  return {
    id: entidad.id,
    slug: entidad.slug,
    nombre: entidad.name,
    nombreCorto: entidad.shortName,
    ruc: entidad.ruc,
    provincia: entidad.province,
    departamento: entidad.department,
    tipoEntidad: entidad.entityType,
  };
}

export async function idMunicipalidadDesdeSlug(slug: string | null | undefined): Promise<string> {
  if (!slug || slug === MUNICIPALIDAD_DEFAULT_SLUG) return MUNICIPALIDAD_DEFAULT_ID;

  const entidad = await prisma.municipality.findFirst({
    where: { slug, isActive: true },
    select: { id: true },
  });

  return entidad?.id ?? MUNICIPALIDAD_DEFAULT_ID;
}

export async function asegurarMunicipalidadActiva(id: string | null | undefined): Promise<string> {
  if (!id || id === MUNICIPALIDAD_DEFAULT_ID) return MUNICIPALIDAD_DEFAULT_ID;

  const entidad = await prisma.municipality.findFirst({
    where: { id, isActive: true },
    select: { id: true },
  });
  if (!entidad) throw new ErrorDeNegocio('La municipalidad seleccionada no está activa o no existe.');
  return entidad.id;
}

export type MunicipalidadAdmin = MunicipalidadActiva & {
  provincia: string;
  departamento: string;
  tipoEntidad: string;
  activa: boolean;
  predeterminada: boolean;
  colorPrincipal: string | null;
  importaciones: number;
  ordenes: number;
};

export type DatosMunicipalidad = {
  id?: string;
  nombre: string;
  nombreCorto: string;
  ruc: string;
  provincia: string;
  departamento: string;
  tipoEntidad: string;
  slug?: string;
  activa: boolean;
  predeterminada: boolean;
  colorPrincipal?: string | null;
};

export async function listarMunicipalidadesAdmin(): Promise<MunicipalidadAdmin[]> {
  const entidades = await prisma.municipality.findMany({
    orderBy: [{ isDefault: 'desc' }, { department: 'asc' }, { province: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      shortName: true,
      ruc: true,
      province: true,
      department: true,
      entityType: true,
      isActive: true,
      isDefault: true,
      primaryColor: true,
      _count: { select: { importBatches: true, orders: true } },
    },
  });

  return entidades.map((entidad) => ({
    id: entidad.id,
    slug: entidad.slug,
    nombre: entidad.name,
    nombreCorto: entidad.shortName,
    ruc: entidad.ruc,
    provincia: entidad.province,
    departamento: entidad.department,
    tipoEntidad: entidad.entityType,
    activa: entidad.isActive,
    predeterminada: entidad.isDefault,
    colorPrincipal: entidad.primaryColor,
    importaciones: entidad._count.importBatches,
    ordenes: entidad._count.orders,
  }));
}

export async function guardarMunicipalidad(input: DatosMunicipalidad & { userId: string | null }) {
  const slug = slugify(input.slug || input.nombreCorto || input.nombre);
  if (!slug) throw new ErrorDeNegocio('No se pudo generar un slug válido para la municipalidad.');
  if (!/^\d{11}$/.test(input.ruc)) throw new ErrorDeNegocio('El RUC debe tener 11 dígitos.');
  if (input.predeterminada && !input.activa) throw new ErrorDeNegocio('La municipalidad predeterminada debe estar activa.');

  const existente = input.id
    ? await prisma.municipality.findUnique({ where: { id: input.id }, select: { id: true, isDefault: true, isActive: true, _count: { select: { importBatches: true, orders: true } } } })
    : null;

  if (input.id && !existente) throw new NoEncontrado('No existe la municipalidad que quieres actualizar.');
  if (existente?.isDefault && !input.activa) throw new ErrorDeNegocio('No puedes desactivar la municipalidad predeterminada.');

  const repetida = await prisma.municipality.findFirst({
    where: {
      OR: [{ slug }, { ruc: input.ruc }],
      ...(input.id ? { id: { not: input.id } } : {}),
    },
    select: { id: true, slug: true, ruc: true },
  });
  if (repetida?.slug === slug) throw new ErrorDeNegocio('Ya existe una municipalidad con ese slug.');
  if (repetida?.ruc === input.ruc) throw new ErrorDeNegocio('Ya existe una municipalidad con ese RUC.');

  return prisma.$transaction(async (tx) => {
    if (input.predeterminada) await tx.municipality.updateMany({ where: { isDefault: true }, data: { isDefault: false } });

    const data = {
      name: input.nombre,
      shortName: input.nombreCorto,
      slug,
      ruc: input.ruc,
      province: input.provincia,
      department: input.departamento,
      entityType: input.tipoEntidad,
      isActive: input.activa,
      isDefault: input.predeterminada,
      primaryColor: input.colorPrincipal || null,
    };

    const entidad = input.id
      ? await tx.municipality.update({ where: { id: input.id }, data, select: { id: true, slug: true, name: true } })
      : await tx.municipality.create({ data, select: { id: true, slug: true, name: true } });

    await registrarAuditoria(tx, {
      userId: input.userId,
      action: input.id ? 'UPDATE' : 'CREATE',
      entity: 'Municipality',
      entityId: entidad.id,
      metadata: { slug: entidad.slug, name: entidad.name, default: input.predeterminada, active: input.activa },
    });

    return entidad;
  });
}
