'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { TextoCoincidente } from '@/components/publico/texto-coincidente';
import { Search } from 'lucide-react';

type Resultado = { total: number; filas: { id: string; numero: string; proveedor: string; descripcion: string | null }[] };

export function BusquedaPortada() {
  const [texto, setTexto] = useState('');
  const [componiendo, setComponiendo] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [estado, setEstado] = useState('Escribe al menos 3 caracteres para buscar en vivo.');
  const secuencia = useRef(0);

  useEffect(() => {
    const turno = ++secuencia.current;
    const controller = new AbortController();
    const termino = texto.trim();
    if (termino.length < 3 || componiendo) return () => controller.abort();
    const timer = setTimeout(async () => {
      setEstado('Buscando…');
      try {
        const response = await fetch(`/api/public/search?texto=${encodeURIComponent(termino)}`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Búsqueda fallida');
        const datos: Resultado = await response.json();
        if (turno !== secuencia.current || controller.signal.aborted) return;
        setResultado(datos);
        setEstado(datos.total ? `${datos.total} órdenes coincidentes.` : 'No hay órdenes que coincidan.');
      } catch {
        if (!controller.signal.aborted && turno === secuencia.current) setEstado('No se pudo buscar. Puedes usar el botón Buscar.');
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [texto, componiendo]);

  return <div className="mt-6">
    <form action="/ordenes" method="get" role="search" className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2 shadow-sm sm:flex-row">
      <div className="flex min-w-0 flex-1 items-center gap-2 pl-2"><Search size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" /><label htmlFor="buscar-portada" className="sr-only">Busca un proveedor, RUC o qué se compró</label><input id="buscar-portada" name="texto" type="search" maxLength={120} value={texto} onChange={evento => { secuencia.current++; setTexto(evento.target.value); setResultado(null); setEstado(evento.target.value.trim().length < 3 ? 'Escribe al menos 3 caracteres para buscar en vivo.' : 'Buscando…'); }} onCompositionStart={() => setComponiendo(true)} onCompositionEnd={() => setComponiendo(false)} aria-describedby="estado-busqueda-portada" placeholder="Busca un proveedor, RUC o qué se compró" className="min-w-0 w-full rounded-lg px-1 py-3 text-base sm:text-sm placeholder:text-muted-foreground" /></div>
      <button className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-emerald-800">Buscar</button>
    </form>
    <p id="estado-busqueda-portada" role="status" aria-live="polite" className="mt-2 text-xs text-muted-foreground">{estado}</p>
    {resultado ? <div className="mt-2 rounded-xl border border-border bg-card p-3"><ul className="divide-y divide-border">{resultado.filas.map(fila => <li key={fila.id}><Link href={`/ordenes/${fila.id}`} className="block rounded-lg p-3 hover:bg-muted"><span className="block text-sm font-semibold">Orden {fila.numero} · {fila.proveedor}</span><span className="mt-1 block line-clamp-3 break-words text-sm text-muted-foreground"><TextoCoincidente texto={fila.descripcion ?? 'Sin descripción'} consulta={texto} /></span></Link></li>)}</ul>{resultado.total > 0 ? <Link href={`/ordenes?texto=${encodeURIComponent(texto.trim())}`} className="mt-2 block p-2 text-sm font-semibold text-primary">Ver todas las coincidencias</Link> : null}</div> : null}
  </div>;
}
