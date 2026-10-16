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
  if (municipalidades.length === 0) return {};

  // La cabecera necesita las configuraciones de todas las entidades para poder
  // cambiar de municipio sin reconstruirse. Antes esto ejecutaba 5 consultas
  // por entidad (100 para 20 municipios). Leemos todas las claves en un único
  // viaje a PostgreSQL y armamos el mapa en memoria.
  const claves = new Set<string>();
  for (const municipalidad of municipalidades) {
    claves.add(clavePortal(municipalidad.id));
    for (const tipo of TIPOS_IMAGEN_PORTAL) claves.add(claveImagenPortal(tipo, municipalidad.id));
  }
  const registros = await prisma.appSetting.findMany({
    where: { key: { in: [...claves] } },
    select: { key: true, value: true },
  });
  const porClave = new Map(registros.map(registro => [registro.key, registro.value]));

  return Object.fromEntries(municipalidades.map(municipalidad => {
    const resultado = esquemaPortal.safeParse(porClave.get(clavePortal(municipalidad.id)));
    const config = resultado.success ? resultado.data : configuracionPorDefecto();
    if (!resultado.success) config.municipio = municipalidad.nombre;

    for (const tipo of TIPOS_IMAGEN_PORTAL) {
      const imagen = esquemaImagenPortal.safeParse(porClave.get(claveImagenPortal(tipo, municipalidad.id)));
      if (!imagen.success) continue;
      if (tipo === 'portada') {
        if (imagen.data.url && !imagen.data.credito) continue;
        config.fotoPortada = imagen.data.url;
        config.creditoFoto = imagen.data.credito;
      } else if (tipo === 'social') config.imagenSocial = imagen.data.url;
      else config[tipo] = imagen.data.url;
    }
    return [municipalidad.slug, config];
  }));
}
