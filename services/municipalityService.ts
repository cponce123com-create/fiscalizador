import { MUNICIPALIDAD_DEFAULT_ID, MUNICIPALIDAD_DEFAULT_SLUG, type MunicipalidadActiva } from '@/lib/municipalidad';
import { prisma } from '@/lib/prisma';

export async function municipalidadPorDefecto(): Promise<MunicipalidadActiva> {
  const entidad =
    (await prisma.municipality.findFirst({
      where: { isDefault: true, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, slug: true, name: true, shortName: true, ruc: true },
    })) ??
    (await prisma.municipality.findUnique({
      where: { id: MUNICIPALIDAD_DEFAULT_ID },
      select: { id: true, slug: true, name: true, shortName: true, ruc: true },
    }));

  return {
    id: entidad?.id ?? MUNICIPALIDAD_DEFAULT_ID,
    slug: entidad?.slug ?? MUNICIPALIDAD_DEFAULT_SLUG,
    nombre: entidad?.name ?? 'Municipalidad Distrital de San Ramón',
    nombreCorto: entidad?.shortName ?? 'San Ramón',
    ruc: entidad?.ruc ?? '20146657142',
  };
}

export async function listarMunicipalidadesActivas(): Promise<MunicipalidadActiva[]> {
  const entidades = await prisma.municipality.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    select: { id: true, slug: true, name: true, shortName: true, ruc: true },
  });

  if (entidades.length === 0) return [await municipalidadPorDefecto()];

  return entidades.map((entidad) => ({
    id: entidad.id,
    slug: entidad.slug,
    nombre: entidad.name,
    nombreCorto: entidad.shortName,
    ruc: entidad.ruc,
  }));
}
