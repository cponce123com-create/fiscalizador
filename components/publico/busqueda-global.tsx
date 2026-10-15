'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Building2, CheckCircle, Loader, Search, SearchX } from 'lucide-react';
import type { ResultadoBusquedaGlobal } from '@/lib/busqueda-global';
import { formatearMonto } from '@/lib/utils';
import { TextoCoincidente } from './texto-coincidente';

export function BusquedaGlobal() {
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState<ResultadoBusquedaGlobal | null>(null);
  const [cargando, setCargando] = useState(false);
  const secuencia = useRef(0);
  const termino = texto.trim();

  useEffect(() => {
    const turno = ++secuencia.current;
    const controller = new AbortController();
    if (termino.length < 3) return () => controller.abort();
    const timer = setTimeout(async () => {
      setCargando(true);
      try {
        const response = await fetch(`/api/public/search/global?texto=${encodeURIComponent(termino)}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error();
        const datos: ResultadoBusquedaGlobal = await response.json();
        if (turno === secuencia.current) setResultado(datos);
      } catch {
        if (!controller.signal.aborted && turno === secuencia.current) setResultado({ totalProveedores: 0, proveedores: [] });
      } finally {
        if (!controller.signal.aborted && turno === secuencia.current) setCargando(false);
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [termino]);

  return <section aria-labelledby="busqueda-global-titulo" className="overflow-hidden rounded-2xl border border-emerald-900/15 bg-gradient-to-br from-emerald-950 to-emerald-800 p-5 text-white shadow-sm sm:p-7">
    <div className="max-w-3xl">
      <p className="text-[10px] font-bold uppercase tracking-[.18em] text-amber-300">Consulta en todas las municipalidades</p>
      <h1 id="busqueda-global-titulo" className="titulo-editorial mt-2 text-2xl font-bold sm:text-3xl">Busca a una persona o empresa en todo Fiscalizador</h1>
      <p className="mt-2 text-sm leading-relaxed text-emerald-100">Escribe un nombre, apellido o RUC. Verás en qué municipalidades aparece, sus periodos, órdenes y monto considerado.</p>
    </div>
    <div role="search" className="mt-5 flex items-center gap-3 rounded-xl bg-white p-2 text-foreground shadow-lg">
      <Search className="ml-2 shrink-0 text-emerald-800" size={20} aria-hidden="true" />
      <label htmlFor="busqueda-global" className="sr-only">Buscar en todas las municipalidades</label>
      <input id="busqueda-global" type="search" value={texto} onChange={e => { const valor = e.target.value; secuencia.current++; setTexto(valor); if (valor.trim().length < 3) { setCargando(false); setResultado(null); } }} maxLength={120} autoComplete="off" placeholder="Ejemplo: Genaro Poma, Galarza o un RUC" className="min-w-0 flex-1 px-1 py-3 text-base outline-none placeholder:text-muted-foreground" />
    </div>
    <p role="status" aria-live="polite" className="mt-2 flex min-h-5 items-center gap-2 text-xs text-emerald-100">
      {termino.length < 3 ? 'Escribe al menos 3 caracteres para iniciar la búsqueda global.' : cargando ? <><Loader size={13} className="animate-spin" />Buscando en todos los distritos…</> : resultado?.totalProveedores ? <><CheckCircle size={13} />{resultado.totalProveedores} proveedor(es) coincidente(s).</> : <><SearchX size={13} />Sin coincidencias en los libros vigentes.</>}
    </p>
    {resultado?.proveedores.length ? <div className="mt-4 grid gap-3">
      {resultado.proveedores.map(proveedor => <article key={proveedor.id} className="rounded-xl bg-white p-4 text-foreground shadow-sm">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
          <div><h2 className="font-bold"><TextoCoincidente texto={proveedor.nombre} consulta={texto} /></h2><p className="mt-1 text-xs text-muted-foreground">RUC {proveedor.ruc} · {proveedor.municipalidades.length} {proveedor.municipalidades.length === 1 ? 'municipalidad' : 'municipalidades'} · {proveedor.ordenes} órdenes</p></div>
          <p className="text-lg font-bold tabular-nums text-emerald-800">{formatearMonto(proveedor.considerado)}</p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {proveedor.municipalidades.map(municipalidad => <Link key={municipalidad.id} href={`/proveedores/${proveedor.slug}?municipalidad=${municipalidad.slug}`} className="rounded-lg border border-border p-3 hover:border-primary hover:bg-muted/40">
            <span className="flex items-center gap-2 text-sm font-semibold"><Building2 size={15} className="text-primary" />{municipalidad.nombre}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{municipalidad.periodos.length ? municipalidad.periodos.join(' · ') : 'Periodo sin clasificar'} · {municipalidad.ordenes} órdenes · {formatearMonto(municipalidad.considerado)}</span>
          </Link>)}
        </div>
      </article>)}
    </div> : null}
  </section>;
}
