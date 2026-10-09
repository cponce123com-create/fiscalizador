'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ResultadosBusqueda } from '@/components/publico/resultados-busqueda';
import type { ResultadoBusquedaPublica } from '@/lib/busqueda-publica';
import { AlertTriangle, CheckCircle, Clock, Loader, Search, SearchX, Sparkles } from 'lucide-react';

const BUSQUEDAS_POPULARES = ['Combustible', 'Genaro Poma', 'Galarza', 'iPad', 'Mantenimiento', 'Prensa'];
const CLAVE_RECIENTES = 'fiscalizador.busquedasRecientes';

export function BusquedaPortada({ textoInicial = '', resultadoInicial = null, municipalidad = null }: { textoInicial?: string; resultadoInicial?: ResultadoBusquedaPublica | null; municipalidad?: string | null }) {
  const searchParams = useSearchParams();
  const municipalidadActiva = searchParams.get('municipalidad') ?? municipalidad;
  const [texto, setTexto] = useState(textoInicial);
  const [componiendo, setComponiendo] = useState(false);
  const [resultado, setResultado] = useState<ResultadoBusquedaPublica | null>(resultadoInicial);
  const [recientes, setRecientes] = useState<string[]>([]);
  const [estado, setEstado] = useState(resultadoInicial ? `${resultadoInicial.totalProveedores} proveedores y ${resultadoInicial.total} órdenes coincidentes.` : 'Escribe al menos 3 caracteres para buscar en vivo.');
  const secuencia = useRef(0);
  const termino = texto.trim();
  const mostrarSugerencias = termino.length < 3 && !resultado;
  const sugerencias = useMemo(() => [...recientes, ...BUSQUEDAS_POPULARES.filter(p => !recientes.some(r => r.toLowerCase() === p.toLowerCase()))].slice(0, 8), [recientes]);

  const recordar = useCallback((busqueda: string) => {
    const limpia = busqueda.trim();
    if (limpia.length < 3) return;
    setRecientes(actuales => {
      const nuevas = [limpia, ...actuales.filter(r => r.toLowerCase() !== limpia.toLowerCase())].slice(0, 6);
      try { localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(nuevas)); } catch {}
      return nuevas;
    });
  }, []);

  function usarSugerencia(busqueda: string) {
    secuencia.current++;
    setTexto(busqueda);
    setResultado(null);
    setEstado('Buscando…');
  }

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const guardadas = JSON.parse(localStorage.getItem(CLAVE_RECIENTES) || '[]');
        if (Array.isArray(guardadas)) setRecientes(guardadas.filter(v => typeof v === 'string').slice(0, 6));
      } catch {}
    });
  }, []);

  useEffect(() => {
    const turno = ++secuencia.current;
    const controller = new AbortController();
    if (termino.length < 3 || componiendo) return () => controller.abort();
    const timer = setTimeout(async () => {
      setEstado('Buscando…');
      try {
        const params = new URLSearchParams({ texto: termino });
        if (municipalidadActiva) params.set('municipalidad', municipalidadActiva);
        const response = await fetch(`/api/public/search?${params.toString()}`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Búsqueda fallida');
        const datos: ResultadoBusquedaPublica = await response.json();
        if (turno !== secuencia.current || controller.signal.aborted) return;
        setResultado(datos);
        if (datos.totalProveedores || datos.total) recordar(termino);
        setEstado(datos.totalProveedores || datos.total ? `${datos.totalProveedores} proveedores y ${datos.total} órdenes coincidentes.` : 'No hay proveedores ni órdenes que coincidan.');
      } catch {
        if (!controller.signal.aborted && turno === secuencia.current) setEstado('No se pudo buscar. Puedes usar el botón Buscar.');
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [texto, componiendo, termino, recordar, municipalidadActiva]);

  return <div className="mt-6">
    <form action="/buscar" method="get" role="search" className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2 shadow-sm sm:flex-row" onSubmit={() => recordar(texto)}>
      {municipalidadActiva ? <input type="hidden" name="municipalidad" value={municipalidadActiva} /> : null}
      <div className="flex min-w-0 flex-1 items-center gap-2 pl-2"><Search size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" /><label htmlFor="buscar-portada" className="sr-only">Busca un proveedor, RUC o qué se compró</label><input id="buscar-portada" name="texto" type="search" maxLength={120} value={texto} onChange={evento => { secuencia.current++; setTexto(evento.target.value); setResultado(null); setEstado(evento.target.value.trim().length < 3 ? 'Escribe al menos 3 caracteres para buscar en vivo.' : 'Buscando…'); }} onCompositionStart={() => setComponiendo(true)} onCompositionEnd={() => setComponiendo(false)} aria-describedby="estado-busqueda-portada" placeholder="Busca un proveedor, RUC o qué se compró" className="min-w-0 w-full rounded-lg px-1 py-3 text-base sm:text-sm placeholder:text-muted-foreground" /></div>
      <button className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-emerald-800">Buscar</button>
    </form>
    <p id="estado-busqueda-portada" role="status" aria-live="polite" className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
      {estado === 'Buscando…' ? <><Loader size={12} className="animate-spin text-primary" aria-hidden="true" />Buscando en proveedores y órdenes...</> : null}
      {estado !== 'Buscando…' && resultado && (resultado.totalProveedores > 0 || resultado.total > 0) ? <><CheckCircle size={12} className="text-success" aria-hidden="true" /><span className="font-medium text-success">{resultado.totalProveedores} proveedores y {resultado.total} órdenes encontradas.</span></> : null}
      {estado !== 'Buscando…' && resultado && resultado.totalProveedores === 0 && resultado.total === 0 ? <><SearchX size={12} className="text-warning" aria-hidden="true" />Sin coincidencias. Prueba con menos palabras o cambia el orden de nombres.</> : null}
      {estado.includes('No se pudo') ? <><AlertTriangle size={12} className="text-destructive" aria-hidden="true" /><span className="text-destructive">{estado}</span></> : null}
      {!resultado && estado !== 'Buscando…' && !estado.includes('No se pudo') ? estado : null}
    </p>
    {mostrarSugerencias && sugerencias.length ? <div className="mt-3 rounded-xl border border-border bg-card p-3">
      <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Sparkles size={14} aria-hidden="true" />Sugerencias rápidas</p>
      <div className="flex flex-wrap gap-2">{sugerencias.map(s => <button key={s} type="button" onClick={() => usarSugerencia(s)} className="boton-enlace inline-flex min-h-9 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary hover:text-primary">{recientes.includes(s) ? <Clock size={12} aria-hidden="true" /> : null}{s}</button>)}</div>
    </div> : null}
    {resultado ? <ResultadosBusqueda resultado={resultado} texto={texto} /> : null}
  </div>;
}
