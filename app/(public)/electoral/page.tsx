import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { BusquedaEnVivo } from '@/components/publico/busqueda-en-vivo';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Antecedentes electorales' };
export default async function DirectorioElectoral({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams;
  const q = (params.q ?? '').trim().slice(0, 120);
  const where = { isPublic: true, records: { some: { isPublic: true } }, ...(q ? { fullName: { contains: q, mode: 'insensitive' as const } } : {}) };
  const total = await prisma.electoralPerson.count({ where });
  const paginas = Math.max(1, Math.ceil(total / 20));
  const page = Math.min(paginas, Math.max(1, Number.parseInt(params.page ?? '1') || 1));
  const personas = await prisma.electoralPerson.findMany({ where, take: 20, skip: (page - 1) * 20, orderBy: [{ fullName: 'asc' }, { id: 'asc' }], select: { id: true, fullName: true } });
  return <div className="flex flex-col gap-6"><header><h1 className="text-2xl font-semibold">Antecedentes electorales</h1><p className="mt-2 text-sm text-muted-foreground">Participaciones registradas con fuentes públicas, incluidas personas que no son proveedores. La organización indicada corresponde a esa elección y no afirma una afiliación actual.</p></header><BusquedaEnVivo ruta="/electoral" consulta={new URLSearchParams({ q, page: String(page) }).toString()} className="flex flex-wrap gap-3"><label className="flex flex-col gap-1 text-sm">Buscar por nombre<input type="search" name="q" maxLength={120} defaultValue={q} className="rounded-md border border-input px-3 py-2" /></label><button className="rounded-md border border-border px-3 py-2">Buscar</button></BusquedaEnVivo><div className="grid gap-3 sm:grid-cols-2">{personas.map(p => <Link key={p.id} href={`/electoral/${p.id}`} className="rounded-lg border border-border bg-card p-4 hover:bg-muted">{p.fullName}</Link>)}</div>{!total ? <p className="text-sm text-muted-foreground">No hay perfiles publicados que coincidan.</p> : null}<nav aria-label="Paginación electoral" className="flex gap-4 text-sm">{page > 1 ? <Link href={`/electoral?${new URLSearchParams({ q, page: String(page - 1) })}`}>Anterior</Link> : null}<span>Página {page} de {paginas}</span>{page < paginas ? <Link href={`/electoral?${new URLSearchParams({ q, page: String(page + 1) })}`}>Siguiente</Link> : null}</nav></div>;
}
