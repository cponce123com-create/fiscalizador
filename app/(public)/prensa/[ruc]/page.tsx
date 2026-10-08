import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { catalogoPrensa } from '@/lib/prensa';
import { contratacionesPrensa } from '@/services/pressService';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ ruc: string }> }): Promise<Metadata> {
  const { ruc } = await params;
  const persona = catalogoPrensa.find(p => p.ruc === ruc);
  return { title: persona?.nombre ?? 'Ficha no encontrada' };
}

export default async function PaginaFichaPrensa({ params }: { params: Promise<{ ruc: string }> }) {
  const { ruc } = await params;
  const persona = catalogoPrensa.find(p => p.ruc === ruc);
  if (!persona) notFound();
  const resumen = await contratacionesPrensa([persona]);
  const ficha = resumen.filas[0];
  // Una sola ficha contractual: en cuanto hay órdenes, reutiliza el perfil existente.
  if (ficha.ordenes > 0) redirect(ficha.perfilUrl);
  return <div className="flex flex-col gap-5">
    <Link href="/prensa" className="boton-enlace inline-flex min-h-11 w-fit items-center rounded-lg border border-border px-3 py-2 text-sm">← Volver al listado de prensa</Link>
    <header className="rounded-xl border border-border bg-card p-6"><h1 className="text-2xl font-semibold">{persona.nombre}</h1><p className="mt-2 text-sm text-muted-foreground">{ficha.tipo} · RUC {persona.ruc}</p></header>
    <section className="rounded-xl border border-dashed border-border p-6"><h2 className="text-xl font-semibold">Órdenes de la municipalidad</h2><p className="mt-3 text-sm text-muted-foreground">No se encontraron órdenes vigentes publicadas para este RUC. La ficha se enlazará automáticamente a su historial de proveedor cuando se importe un libro que contenga una coincidencia.</p><p className="mt-3 text-xs text-muted-foreground">La ausencia de registros no significa que esta persona o empresa no haya contratado con el Estado.</p><Link href="/fuentes" className="mt-4 inline-block text-sm text-primary underline">Consultar fuentes y cobertura disponible</Link></section>
  </div>;
}
