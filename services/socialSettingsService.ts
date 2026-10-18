import { configuracionPorDefecto, type ConfiguracionPortal } from '@/lib/portal-settings';
import { leerConfiguracionPortal } from '@/services/portalService';

// Caché pequeña por proceso; una consulta compartida evita acumular llamadas si Neon tarda.
let ultimo: ConfiguracionPortal | undefined;
let vence = 0;
let pendiente: Promise<ConfiguracionPortal> | undefined;
export async function configuracionSocialRapida(): Promise<ConfiguracionPortal> {
  if (ultimo && Date.now() < vence) return ultimo;
  if (!pendiente) pendiente = leerConfiguracionPortal().then(config => {
    ultimo = config;
    vence = Date.now() + 60_000;
    return config;
  }).catch(() => ultimo ?? configuracionPorDefecto()).finally(() => { pendiente = undefined; });
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      pendiente,
      new Promise<ConfiguracionPortal>(resolve => {
        temporizador = setTimeout(() => resolve(ultimo ?? configuracionPorDefecto()), 800);
      }),
    ]);
  } finally { if (temporizador) clearTimeout(temporizador); }
}
