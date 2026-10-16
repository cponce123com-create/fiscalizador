'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ResultadosBusqueda } from '@/components/publico/resultados-busqueda';
import type { ResultadoBusquedaPublica } from '@/lib/busqueda-publica';
import { AlertTriangle, CheckCircle, Loader, Search, SearchX } from 'lucide-react';

export function BusquedaPortada({ textoInicial = '', resultadoInicial = null, municipalidad = null }: { textoInicial?: string; resultadoInicial?: ResultadoBusquedaPublica | null; municipalidad?: string | null }) {
  const searchParams = useSearchParams();
  const municipalidadActiva = searchParams.get('municipalidad') ?? municipalidad;
  const [texto, setTexto] = useState(textoInicial);
  const [componiendo, setComponiendo] = useState(false);
  const [resultado, setResultado] = useState<ResultadoBusquedaPublica | null>(resultadoInicial);
  const [estado, setEstado] = useState(resultadoInicial ? `${resultadoInicial.totalProveedores} proveedores y ${resultadoInicial.total} órdenes coincidentes.` : 'Escribe al menos 3 caracteres para buscar en vivo.');
  const secuencia = useRef(0);
  const registrada = useRef('');
  const termino = texto.trim();
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
        setEstado(datos.totalProveedores || datos.total ? `${datos.totalProveedores} proveedores y ${datos.total} órdenes coincidentes.` : 'No hay proveedores ni órdenes que coincidan.');
      } catch {
        if (!controller.signal.aborted && turno === secuencia.current) setEstado('No se pudo buscar. Puedes usar el botón Buscar.');
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [texto, componiendo, termino, municipalidadActiva]);

  useEffect(() => {
    if ((!resultado?.totalProveedores && !resultado?.total) || termino.length < 3 || registrada.current === termino) return;
    const timer = setTimeout(() => {
      registrada.current = termino;
      void fetch('/api/public/search/record', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: termino }), keepalive: true });
    }, 1200);
    return () => clearTimeout(timer);
  }, [resultado, termino]);

  return <div className="mt-6">
    <form action="/buscar" method="get" role="search" className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2 shadow-sm sm:flex-row">
      {municipalidadActiva ? <input type="hidden" name="municipalidad" value={municipalidadActiva} /> : null}
      <div className="flex min-w-0 flex-1 items-center gap-2 pl-2"><Search size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" /><label htmlFor="buscar-portada" className="sr-only">Buscar proveedor, orden o compra en la municipalidad seleccionada</label><input id="buscar-portada" name="texto" type="search" maxLength={120} value={texto} onChange={evento => { secuencia.current++; setTexto(evento.target.value); setResultado(null); setEstado(evento.target.value.trim().length < 3 ? 'Escribe al menos 3 caracteres para buscar en vivo.' : 'Buscando…'); }} onCompositionStart={() => setComponiendo(true)} onCompositionEnd={() => setComponiendo(false)} aria-describedby="estado-busqueda-portada" placeholder="Proveedor, orden o concepto en esta municipalidad" className="min-w-0 w-full rounded-lg px-1 py-3 text-base sm:text-sm placeholder:text-muted-foreground" /></div>
      <button className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-emerald-800">Buscar</button>
    </form>
    <p id="estado-busqueda-portada" role="status" aria-live="polite" className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
      {estado === 'Buscando…' ? <><Loader size={12} className="animate-spin text-primary" aria-hidden="true" />Buscando en proveedores y órdenes...</> : null}
      {estado !== 'Buscando…' && resultado && (resultado.totalProveedores > 0 || resultado.total > 0) ? <><CheckCircle size={12} className="text-success" aria-hidden="true" /><span className="font-medium text-success">{resultado.totalProveedores} proveedores y {resultado.total} órdenes encontradas.</span></> : null}
      {estado !== 'Buscando…' && resultado && resultado.totalProveedores === 0 && resultado.total === 0 ? <><SearchX size={12} className="text-warning" aria-hidden="true" />Sin coincidencias. Prueba con menos palabras o cambia el orden de nombres.</> : null}
      {estado.includes('No se pudo') ? <><AlertTriangle size={12} className="text-destructive" aria-hidden="true" /><span className="text-destructive">{estado}</span></> : null}
      {!resultado && estado !== 'Buscando…' && !estado.includes('No se pudo') ? estado : null}
    </p>
    {resultado ? <ResultadosBusqueda resultado={resultado} texto={texto} /> : null}
  </div>;
}
