'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowUpRight, LoaderCircle } from 'lucide-react';
import type { ResultadoIA } from '@/lib/ia';
import { formatearMonto } from '@/lib/utils';

const ejemplos = ['Proveedores con órdenes en varias municipalidades', 'Compara gastos en publicidad durante 2025', 'Contrataciones de Genaro Poma'];
export function AsistenteIA() {
  const [pregunta, setPregunta] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [datos, setDatos] = useState<ResultadoIA | null>(null);
  async function consultar(event: React.FormEvent) {
    event.preventDefault();
    if (cargando) return;
    setCargando(true); setError(''); setDatos(null);
    const form = new FormData(); form.set('pregunta', pregunta);
    try {
      const r = await fetch('/api/public/ia', { method: 'POST', body: form, signal: AbortSignal.timeout(45000) });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || 'Consulta no disponible.');
      setDatos(json);
    } catch (e) { setError(e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'La consulta tardó demasiado. Puedes utilizar el buscador global.'); }
    finally { setCargando(false); }
  }
  return <section aria-labelledby="titulo-asistente" className="min-w-0 rounded-2xl border border-emerald-800/20 bg-gradient-to-br from-emerald-50 to-white p-4 sm:p-6">
    <div className="flex items-start gap-3"><span className="rounded-xl bg-emerald-900 p-2.5 text-emerald-100"><Sparkles size={22} aria-hidden="true" /></span><div><h2 id="titulo-asistente" className="text-lg font-bold text-emerald-950">Pregúntale a Fiscalizador</h2><p className="mt-1 text-sm text-slate-600">Explora contrataciones de todas las municipalidades con una pregunta.</p></div><span className="ml-auto rounded-full border border-emerald-200 px-2 py-1 text-[10px] font-semibold text-emerald-800">BETA</span></div>
    <form onSubmit={consultar} className="mt-4 flex flex-col gap-2 sm:flex-row">
      <label htmlFor="pregunta-ia" className="sr-only">Pregunta sobre contrataciones</label><input id="pregunta-ia" value={pregunta} onChange={e => setPregunta(e.target.value)} minLength={8} maxLength={400} required disabled={cargando} placeholder="¿Qué quieres conocer sobre las contrataciones?" className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600" />
      <button disabled={cargando} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-950 bg-emerald-900 px-5 font-semibold text-white disabled:opacity-60">{cargando ? <><LoaderCircle className="animate-spin" size={18} />Consultando…</> : 'Consultar'}</button>
    </form>
    <div className="mt-3 flex flex-wrap gap-2">{ejemplos.map(e => <button key={e} type="button" disabled={cargando} onClick={() => setPregunta(e)} className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-left text-xs text-emerald-900 hover:bg-emerald-50">{e}</button>)}</div>
    <p className="mt-3 text-xs text-slate-500">La pregunta se envía al proveedor de IA configurado. No incluyas datos privados. Los montos se calculan en la base de datos.</p>
    <div aria-live="polite" aria-busy={cargando}>{error && <p role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{error}</p>}
      {datos && <div className="mt-5 border-t border-emerald-200 pt-4">
        <h3 className="font-bold text-emerald-950">Resultados verificables</h3><p className="mt-1 break-words text-sm">Alcance: {datos.alcance}. Años: {datos.plan.desde ?? 'inicio disponible'} a {datos.plan.hasta ?? 'último disponible'}.</p>
        <p className="mt-1 text-xs text-slate-600">Filtros interpretados: proveedor {datos.plan.proveedor || 'todos'} · categoría {datos.plan.categoria || 'todas'} · {datos.plan.variasMunicipalidades ? 'proveedores presentes en al menos dos entidades del alcance' : 'sin mínimo de entidades'}.</p>
        <p className="mt-2 text-xs text-slate-600">Monto de órdenes vigentes con efecto económico. Excluye anuladas y libros pendientes de revisión; no acredita pagos. Cobertura según libros disponibles.</p>
        {!!datos.resumen.length && <div className="mt-4 overflow-x-auto rounded-xl border border-emerald-200 bg-white"><table className="w-full text-left text-xs sm:text-sm"><caption className="p-3 text-left font-semibold">Comparación por municipalidad y gestión</caption><thead><tr><th className="p-3">Municipalidad / gestión</th><th className="p-3">Órdenes</th><th className="p-3">Monto considerado</th></tr></thead><tbody>{datos.resumen.map((r, i) => <tr key={i} className="border-t"><td className="p-3">{r.municipalidad}<br />{r.gestion}</td><td className="p-3">{r.ordenes}</td><td className="whitespace-nowrap p-3 font-semibold">{formatearMonto(r.monto)}</td></tr>)}</tbody></table></div>}
        {!datos.filas.length ? <p className="mt-4">No se encontraron órdenes para estos filtros. Esto no demuestra ausencia de contrataciones fuera de los libros disponibles.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{datos.filas.map((f, i) => <article key={i} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3"><Link className="flex items-start gap-1 break-words font-semibold text-emerald-900 underline" href={`/proveedores/${encodeURIComponent(f.slug)}?municipalidad=${encodeURIComponent(f.municipalidadSlug)}`}>{f.proveedor}<ArrowUpRight className="shrink-0" size={15} /></Link><p className="mt-1 text-xs text-slate-600">{f.municipalidad} · {f.gestion}</p><p className="mt-2 text-lg font-bold">{formatearMonto(f.monto)}</p><p className="text-xs">{f.ordenes} órdenes consideradas</p></article>)}</div>}
        {datos.limitado && <p className="mt-3 text-sm">Se muestran los primeros 50 grupos por monto. Acota el proveedor, categoría o año para reducir los resultados.</p>}
        {!!datos.fuentes.length && <details className="mt-4 rounded-xl border border-emerald-200 bg-white p-3"><summary className="cursor-pointer font-semibold">Consultar órdenes de respaldo ({datos.fuentes.length}, muestra)</summary><ul className="mt-3 space-y-3">{datos.fuentes.map(f => <li key={f.id} className="text-sm"><Link className="text-emerald-900 underline" href={`/ordenes/${encodeURIComponent(f.id)}`}>Orden {f.numero} · {f.municipio}</Link><p className="text-xs text-slate-600">{f.descripcion}</p></li>)}</ul></details>}
      </div>}
    </div>
  </section>;
}
