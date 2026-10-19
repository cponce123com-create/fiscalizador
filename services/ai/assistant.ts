import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { planIA } from '@/lib/ia';
import { interpretarPregunta } from './provider';
import { consultarDatos } from './query';
import { reservarUso } from './settings';

export async function responderPregunta(pregunta: string, publico: boolean) {
  const municipios = await prisma.municipality.findMany({ where: { isActive: true }, select: { slug: true, name: true }, orderBy: { slug: 'asc' }, take: 200 });
  const hash = createHash('sha256').update(JSON.stringify([1, process.env.AI_BASE_URL, process.env.AI_MODEL, municipios, pregunta.trim().toLowerCase()])).digest('hex');
  const key = `ia:plan:${hash}`;
  const cache = await prisma.appSetting.findUnique({ where: { key } });
  const parsed = planIA.safeParse(cache?.value);
  let plan = parsed.success && cache && Date.now() - cache.updatedAt.getTime() < 7 * 86400000 ? parsed.data : null;
  if (!plan) {
    await reservarUso(publico);
    plan = await interpretarPregunta(pregunta, municipios);
    await prisma.appSetting.upsert({ where: { key }, create: { key, value: plan }, update: { value: plan } });
    await prisma.appSetting.deleteMany({ where: { key: { startsWith: 'ia:plan:' }, updatedAt: { lt: new Date(Date.now() - 7 * 86400000) } } });
  }
  if (plan.accion === 'no_admitida') throw new Error('IA_NO_ADMITIDA');
  // Solo se reutiliza la interpretación; los importes se consultan de nuevo, sin cifras obsoletas.
  return consultarDatos(plan);
}
