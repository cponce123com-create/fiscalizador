import type { Metadata } from 'next';
import { Eye, Scale, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = { title: 'Visión y reglas del proyecto', description: 'Propósito, principios y reglas editoriales de Fiscalizador.' };

export default function Proyecto() {
  return <article className="mx-auto max-w-4xl space-y-8">
    <header><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Información institucional</p><h1 className="titulo-editorial mt-2 text-3xl font-bold sm:text-4xl">Visión y reglas de Fiscalizador</h1><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Fiscalizador organiza información pública municipal para que cualquier vecino pueda consultarla, compararla y contrastarla con sus documentos de origen.</p></header>
    <section className="grid gap-4 md:grid-cols-3">
      <Principio icono={Eye} titulo="Transparencia útil">Convertir libros dispersos en consultas comprensibles, sin alterar el contenido de las fuentes.</Principio>
      <Principio icono={ShieldCheck} titulo="Evidencia verificable">Cada cifra debe poder rastrearse hasta un libro, una orden o una fuente pública identificable.</Principio>
      <Principio icono={Scale} titulo="Fiscalización responsable">Una coincidencia, vínculo o monto elevado orienta una revisión; por sí solo no demuestra una irregularidad.</Principio>
    </section>
    <section className="panel-portada space-y-4"><h2 className="titulo-editorial text-2xl font-bold">Reglas de publicación</h2><ul className="list-disc space-y-3 pl-5 text-sm leading-relaxed text-muted-foreground"><li>Se distinguen los montos registrados de los montos considerados y se excluyen de estos últimos las órdenes anuladas o estados no económicos.</li><li>La cobertura depende de los libros disponibles; la ausencia de un periodo no significa que el gasto haya sido cero.</li><li>Los perfiles, antecedentes y vínculos deben identificar su fuente y no se presentan como prueba automática de delito, nepotismo o conflicto de intereses.</li><li>Las correcciones conservan trazabilidad administrativa y deben reflejarse en la información pública vigente.</li><li>El portal es una iniciativa ciudadana independiente y no representa a las municipalidades consultadas.</li></ul></section>
  </article>;
}

function Principio({ icono: Icono, titulo, children }: { icono: typeof Eye; titulo: string; children: React.ReactNode }) {
  return <div className="panel-portada"><Icono className="text-primary" size={24} aria-hidden="true" /><h2 className="mt-4 font-bold">{titulo}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p></div>;
}
