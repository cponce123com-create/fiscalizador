import { prisma } from '@/lib/prisma';
import { cache } from 'react';
import { CLAVE_PORTAL, configuracionPorDefecto, esquemaPortal } from '@/lib/portal-settings';
import { claveImagenPortal, esquemaImagenPortal, TIPOS_IMAGEN_PORTAL } from '@/lib/portal-images';

export const leerConfiguracionPortal = cache(async function leerConfiguracionPortal() {
  const registro = await prisma.appSetting.findUnique({ where: { key: CLAVE_PORTAL } });
  const resultado = esquemaPortal.safeParse(registro?.value);
  const config = resultado.success ? resultado.data : configuracionPorDefecto();
  const imagenes = await Promise.all(TIPOS_IMAGEN_PORTAL.map(async tipo => {
    const registro = await prisma.appSetting.findUnique({ where: { key: claveImagenPortal(tipo) } });
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
