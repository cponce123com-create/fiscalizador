export default function CargandoPaginaEstadisticas() {
  return <div className="flex animate-pulse flex-col gap-7" role="status" aria-label="Cargando estadísticas">
    <div className="h-5 w-28 rounded bg-muted" />
    <div className="space-y-3"><div className="h-9 w-48 rounded bg-muted" /><div className="h-4 max-w-2xl rounded bg-muted" /><div className="h-4 max-w-xl rounded bg-muted" /></div>
    <div className="flex gap-2 overflow-hidden">{[1, 2, 3].map(item => <div key={item} className="h-11 w-36 shrink-0 rounded-lg bg-muted" />)}</div>
    {[1, 2, 3].map(item => <div key={item} className="h-52 rounded-2xl border border-border bg-card" />)}
    <span className="sr-only">Preparando estadísticas de la municipalidad seleccionada…</span>
  </div>;
}
