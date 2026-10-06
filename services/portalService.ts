import { prisma } from '@/lib/prisma';
import { CLAVE_PORTAL, configuracionPorDefecto, esquemaPortal } from '@/lib/portal-settings';

export async function leerConfiguracionPortal() {
  const registro = await prisma.appSetting.findUnique({ where: { key: CLAVE_PORTAL } });
  const resultado = esquemaPortal.safeParse(registro?.value);
  return resultado.success ? resultado.data : configuracionPorDefecto();
}
