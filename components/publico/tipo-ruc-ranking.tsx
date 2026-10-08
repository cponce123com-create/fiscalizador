import Link from 'next/link';
import { serializarFiltros, type Filtros } from '@/lib/filtros';

export function TipoRucRanking({ filtros, ruta }: { filtros: Filtros; ruta: '/' | '/ranking' }) {
  const opciones = [
    { valor: null, etiqueta: 'Todos' },
    { valor: '10' as const, etiqueta: 'RUC 10 · personas naturales' },
    { valor: '20' as const, etiqueta: 'RUC 20 · personas jurídicas' },
  ];
  return <nav aria-label="Tipo de proveedor del ranking" className="mb-4 flex flex-wrap gap-2">{opciones.map(o => <Link key={o.valor ?? 'todos'} prefetch={false} scroll={false} href={`${ruta}${serializarFiltros(filtros, { tipoRuc: o.valor, pagina: 1 })}`} aria-current={filtros.tipoRuc === o.valor ? 'page' : undefined} className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border px-3 py-2 text-center text-xs font-semibold transition-colors ${filtros.tipoRuc === o.valor ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-muted'}`}>{o.etiqueta}</Link>)}</nav>;
}
