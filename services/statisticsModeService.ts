import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { MUNICIPALIDAD_DEFAULT_ID } from '@/lib/municipalidad';

export type ModoComparacion = 'MANAGEMENT' | 'ROLLING_YEARS';

export const configuracionComparacion = cache(async function configuracionComparacion(municipalityId = MUNICIPALIDAD_DEFAULT_ID): Promise<{ modo: ModoComparacion; anios: number }> {
  const entidad = await prisma.municipality.findUnique({ where: { id: municipalityId }, select: { comparisonMode: true, comparisonYears: true } });
  const modo = entidad?.comparisonMode === 'ROLLING_YEARS' ? 'ROLLING_YEARS' : 'MANAGEMENT';
  return { modo, anios: Math.max(1, Math.min(10, entidad?.comparisonYears ?? 5)) };
});
