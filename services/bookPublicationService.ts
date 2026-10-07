import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getStorage } from '@/services/storageService';

export const claveOriginal = (id: string) => `libro-original-publico:${id}`;
export function esOriginalPublicado(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'publicado' in value && value.publicado === true;
}
export async function originalPublicado(id: string): Promise<boolean> {
  const ajuste = await prisma.appSetting.findUnique({ where: { key: claveOriginal(id) } });
  return esOriginalPublicado(ajuste?.value);
}
/** Las restricciones sobre columnas siguen aplicándose al archivo sin normalizar. */
export async function tieneColumnasPrivadas(id: string): Promise<boolean> {
  const globales = await prisma.columnVisibility.findMany({ where: { isPublic: false }, select: { internalField: true } });
  return Boolean(await prisma.importColumn.findFirst({ where: { importBatchId: id, OR: [{ isPublic: false }, { internalField: { in: globales.map(c => c.internalField) } }] }, select: { id: true } }));
}
export async function leerOriginalVerificado(storageKey: string, checksum: string): Promise<Buffer> {
  const archivo = await getStorage().read(storageKey);
  if (createHash('sha256').update(archivo).digest('hex') !== checksum) throw new Error('El original almacenado no coincide con su huella. Reincorpora el archivo correcto antes de publicarlo.');
  return archivo;
}
