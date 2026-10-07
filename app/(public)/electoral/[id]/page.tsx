import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { AntecedentesElectorales } from '@/components/publico/antecedentes-electorales';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Perfil electoral' };
export default async function PerfilElectoral({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const alias = await prisma.electoralPersonAlias.findUnique({ where: { id } });
  if (alias) redirect(`/electoral/${alias.personId}`);
  const persona = await prisma.electoralPerson.findFirst({ where: { id, isPublic: true, records: { some: { isPublic: true } } }, select: { id: true, fullName: true, dni: true, records: { where: { isPublic: true }, orderBy: { electionYear: 'desc' }, select: { id: true, electionYear: true, position: true, organization: true, mayorCandidate: true, municipality: true, termStart: true, termEnd: true, result: true, listPosition: true, registrationStatus: true, preliminaryOutcome: true, preliminarySource: true, source: true, sourceUrl: true } } } });
  if (!persona) notFound();
  const proveedores = persona.dni ? await prisma.supplier.findMany({ where: { ruc: { startsWith: `10${persona.dni}` } }, select: { id: true, name: true, slug: true, ruc: true, _count: { select: { orders: true } } }, take: 20 }) : [];
  return <div className="flex flex-col gap-6"><Link href="/electoral" className="text-sm text-primary underline">Volver al registro electoral</Link><header><h1 className="text-2xl font-semibold">{persona.fullName}</h1><p className="mt-2 text-sm text-muted-foreground">Antecedentes históricos según los documentos citados. Participar en una elección o contratar con una municipalidad no demuestra una irregularidad.</p></header><AntecedentesElectorales registros={persona.records} /><section><h2 className="mb-3 text-xl font-semibold">Coincidencias con proveedores</h2>{proveedores.length ? proveedores.map(p => <Link key={p.id} href={`/proveedores/${p.slug}`} className="mb-3 block rounded-lg border border-border p-4"><strong>{p.name}</strong><p className="mt-1 text-sm text-muted-foreground">RUC {p.ruc} · {p._count.orders} órdenes registradas</p></Link>) : <p className="text-sm text-muted-foreground">No hay proveedores enlazados por documento en los registros actuales. Las coincidencias de nombre no se enlazan automáticamente.</p>}</section></div>;
}
