import type { MetadataRoute } from 'next';

import { prisma } from '@/lib/prisma';
import { urlDelSitio } from '@/lib/site';

/**
 * `sitemap.xml`.
 *
 * Incluye las páginas fijas del portal y una entrada por proveedor. Se regenera cada
 * hora: los listados cambian con las importaciones, pero un buscador no necesita verlo
 * al segundo.
 *
 * Si algún día hubiera más de 50.000 proveedores habría que partirlo en varios sitemaps:
 * es el tope del formato.
 */
export const revalidate = 3600;

/** Rutas públicas, con su prioridad relativa. */
const RUTAS_FIJAS = [
  { ruta: '/', prioridad: 1 },
  { ruta: '/estadisticas', prioridad: 0.9 },
  { ruta: '/ranking', prioridad: 0.8 },
  { ruta: '/proveedores', prioridad: 0.8 },
  { ruta: '/ordenes', prioridad: 0.7 },
  { ruta: '/historial', prioridad: 0.6 },
  { ruta: '/vinculos', prioridad: 0.6 },
  { ruta: '/fuentes', prioridad: 0.6 },
  { ruta: '/metodologia', prioridad: 0.5 },
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = urlDelSitio();

  const fijas: MetadataRoute.Sitemap = RUTAS_FIJAS.map(({ ruta, prioridad }) => ({
    url: `${base}${ruta}`,
    changeFrequency: 'daily',
    priority: prioridad,
  }));

  const proveedores = await prisma.supplier.findMany({
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });

  const fichas: MetadataRoute.Sitemap = proveedores.map((proveedor) => ({
    url: `${base}/proveedores/${proveedor.slug}`,
    lastModified: proveedor.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.5,
  }));

  return [...fijas, ...fichas];
}
