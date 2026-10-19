import { prisma } from '@/lib/prisma';
import { configuracionIA } from '@/lib/ia';

export const CLAVE_IA = 'ia:config:v1';
export const RESERVA_TOKENS = 12000;
export function clavesUso(fecha = new Date()) {
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha);
  return [`ia:uso:${dia.slice(0, 7)}`, `ia:uso:${dia}`];
}
export async function leerIA() {
  const setting = await prisma.appSetting.findUnique({ where: { key: CLAVE_IA } });
  const parsed = configuracionIA.safeParse(setting?.value);
  return parsed.success ? parsed.data : configuracionIA.parse({});
}
export function proveedorListo() { return Boolean(process.env.AI_API_KEY?.trim() && process.env.AI_MODEL?.trim()); }

/** Reservas conservadoras, sin devolución: sobreviven reinicios y concurrencia entre instancias. */
export async function reservarUso(publico: boolean) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext('fiscalizador-ia-budget'))`;
    const registro = await tx.appSetting.findUnique({ where: { key: CLAVE_IA } });
    const config = configuracionIA.parse(registro?.value ?? {});
    if (!config.enabled || (publico && !config.publicEnabled)) throw new Error('IA_DESACTIVADA');
    const keys = clavesUso();
    const limites = [config.monthlyTokens, config.dailyTokens];
    for (let i = 0; i < keys.length; i++) {
      const anterior = await tx.appSetting.findUnique({ where: { key: keys[i] } });
      const valor = anterior?.value as { reservado?: number; llamadas?: number } | undefined;
      const reservado = Number(valor?.reservado ?? 0) + RESERVA_TOKENS;
      if (reservado > limites[i]) throw new Error('IA_LIMITE');
      const value = { reservado, llamadas: Number(valor?.llamadas ?? 0) + 1 };
      await tx.appSetting.upsert({ where: { key: keys[i] }, create: { key: keys[i], value }, update: { value } });
    }
  });
}
