import { prisma } from '@/lib/prisma';
import { normalizeKey } from '@/services/normalization';

function terminoValido(texto: string) {
  const displayTerm = texto.trim().replace(/\s+/g, ' ').slice(0, 60);
  const normalizedTerm = normalizeKey(displayTerm);
  if (normalizedTerm.length < 3 || normalizedTerm.length > 60) return null;
  return { displayTerm, normalizedTerm };
}

/** Registra solo un contador agregado; no asocia la consulta con una persona. */
export async function registrarBusquedaPublica(texto: string) {
  const termino = terminoValido(texto);
  if (!termino) return false;
  await prisma.publicSearchTerm.upsert({
    where: { normalizedTerm: termino.normalizedTerm },
    create: termino,
    update: { uses: { increment: 1 }, lastUsedAt: new Date() },
  });
  return true;
}

export async function busquedasPopulares(limite = 6): Promise<string[]> {
  const filas = await prisma.publicSearchTerm.findMany({
    orderBy: [{ uses: 'desc' }, { lastUsedAt: 'desc' }],
    take: Math.min(10, Math.max(1, limite)),
    select: { displayTerm: true },
  });
  return filas.map(fila => fila.displayTerm);
}
