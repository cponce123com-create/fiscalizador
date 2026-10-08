export default function CargandoPortal() {
  return <div role="status" className="flex flex-col gap-4"><p className="text-sm font-medium text-muted-foreground">Cargando información del portal…</p><div aria-hidden="true" className="grid gap-4 md:grid-cols-2">{[1, 2, 3, 4].map(i => <div key={i} className="panel-portada min-h-40"><div className="h-5 w-2/3 rounded bg-muted" /><div className="mt-4 h-3 w-full rounded bg-muted" /><div className="mt-3 h-3 w-4/5 rounded bg-muted" /></div>)}</div></div>;
}
