import type { Prisma } from '@/lib/generated/prisma/client';
export function palabrasBusqueda(texto: string): string[] {
  return [...new Set(texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().match(/[a-z0-9]+/g) ?? [])];
}
/** Grupos excluyentes: la relevancia se aplica antes del skip/take en PostgreSQL. */
export function gruposBusquedaOrdenes(texto: string, base: Prisma.OrderWhereInput): Prisma.OrderWhereInput[] {
  const palabras = palabrasBusqueda(texto);
  if (!palabras.length) return [base];
  const criterios: Prisma.OrderWhereInput[] = [
    { OR: [{ orderNumber: { equals: texto, mode: 'insensitive' } }, { siafNumber: { not: null, equals: texto, mode: 'insensitive' } }, { ruc: { equals: texto } }] },
    { descriptionSearch: { contains: ` ${palabras.join(' ')} ` } },
    { AND: palabras.map(p => ({ descriptionSearch: { contains: ` ${p} ` } })) },
    { AND: palabras.map(p => ({ descriptionSearch: { contains: p } })) },
  ];
  return [...criterios.map((criterio, i) => ({ AND: [base, criterio, ...(i ? [{ NOT: { OR: criterios.slice(0, i) } }] : [])] })), { AND: [base, { NOT: { OR: criterios } }] }];
}
export function paginasPorGrupo(conteos: number[], pagina: number, porPagina: number) {
  let skip = (pagina - 1) * porPagina; let faltan = porPagina;
  return conteos.flatMap((total, grupo) => {
    if (skip >= total) { skip -= total; return []; }
    const take = Math.min(faltan, total - skip);
    const parte = take ? [{ grupo, skip, take }] : [];
    skip = 0; faltan -= take;
    return parte;
  });
}
