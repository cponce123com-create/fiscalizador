import Link from 'next/link';

export type AntecedenteElectoral = { id: string; electionYear: number; position: string; organization: string; mayorCandidate: string; municipality: string; termStart: number; termEnd: number; result: string; source: string; sourceUrl: string };
export function AntecedentesElectorales({ registros }: { registros: AntecedenteElectoral[] }) {
  return <div className="grid gap-4 sm:grid-cols-2">{registros.map(r => <article key={r.id} className="rounded-lg border border-border bg-card p-4">
    <h3 className="font-semibold">Elecciones {r.electionYear} · {r.position.toLowerCase()}</h3>
    <dl className="mt-3 grid gap-2 text-sm"><div><dt className="text-muted-foreground">Organización en esa elección</dt><dd>{r.organization}</dd></div><div><dt className="text-muted-foreground">Candidato a alcalde de la lista</dt><dd>{r.mayorCandidate}</dd></div><div><dt className="text-muted-foreground">Municipalidad y periodo</dt><dd>{r.municipality} · {r.termStart}–{r.termEnd}</dd></div><div><dt className="text-muted-foreground">Resultado según la fuente</dt><dd>{r.result === 'ELECTO' ? 'Electo' : r.result === 'NO_ELECTO' ? 'No electo' : r.result === 'IMPROCEDENTE' ? 'Candidatura improcedente' : 'Por verificar'}</dd></div></dl>
    <p className="mt-3 text-xs text-muted-foreground">Fuente: {r.source}</p><Link href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-primary underline">Consultar documento</Link>
  </article>)}</div>;
}
