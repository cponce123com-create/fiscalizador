import { prisma } from '@/lib/prisma';
import { cache } from 'react';
import { clavePortal, configuracionPorDefecto, esquemaPortal, type ConfiguracionPortal } from '@/lib/portal-settings';
import { claveImagenPortal, esquemaImagenPortal, TIPOS_IMAGEN_PORTAL } from '@/lib/portal-images';
import { MUNICIPALIDAD_DEFAULT_ID, type MunicipalidadActiva } from '@/lib/municipalidad';

export const leerConfiguracionPortal = cache(async function leerConfiguracionPortal(municipalityId = MUNICIPALIDAD_DEFAULT_ID) {
  const registro = await prisma.appSetting.findUnique({ where: { key: clavePortal(municipalityId) } });
  const resultado = esquemaPortal.safeParse(registro?.value);
  const config = resultado.success ? resultado.data : configuracionPorDefecto();
  if (!resultado.success && municipalityId !== MUNICIPALIDAD_DEFAULT_ID) {
    const municipalidad = await prisma.municipality.findUnique({ where: { id: municipalityId }, select: { name: true } });
    if (municipalidad) config.municipio = municipalidad.name;
  }
  const imagenes = await Promise.all(TIPOS_IMAGEN_PORTAL.map(async tipo => {
    const registro = await prisma.appSetting.findUnique({ where: { key: claveImagenPortal(tipo, municipalityId) } });
    return { tipo, imagen: esquemaImagenPortal.safeParse(registro?.value) };
  }));
  for (const { tipo, imagen } of imagenes) {
    if (!imagen.success) continue;
    if (tipo === 'portada') {
      if (imagen.data.url && !imagen.data.credito) continue;
      config.fotoPortada = imagen.data.url;
      config.creditoFoto = imagen.data.credito;
    } else if (tipo === 'social') config.imagenSocial = imagen.data.url;
    else config[tipo] = imagen.data.url;
  }
  return config;
});

export async function configuracionesPorMunicipalidad(municipalidades: MunicipalidadActiva[]): Promise<Record<string, ConfiguracionPortal>> {
  return Object.fromEntries(await Promise.all(municipalidades.map(async municipalidad => [municipalidad.slug, await leerConfiguracionPortal(municipalidad.id)])));
}
