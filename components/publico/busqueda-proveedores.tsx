'use client';

import { useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircle, Search, X } from 'lucide-react';
import { serializarFiltros, type Filtros } from '@/lib/filtros';
import { destinoBusquedaProveedores, ESPERA_BUSQUEDA_PROVEEDORES } from '@/lib/busqueda-proveedores';

/** Mejora el formulario GET: PostgreSQL conserva la búsqueda, el conteo y la paginación. */
export function BusquedaProveedores({ filtros }: { filtros: Filtros }) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const texto = useRef<HTMLInputElement>(null);
  const tipo = useRef<HTMLSelectElement>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const solicitudes = useRef(new Set<string>());
  const ultimaSolicitud = useRef<string | null>(null);
  const componiendo = useRef(false);
  const consulta = serializarFiltros(filtros);

  function cancelarEspera() {
    if (temporizador.current !== null) clearTimeout(temporizador.current);
    temporizador.current = null;
  }

  useEffect(() => {
    // Una respuesta propia no reemplaza las teclas escritas durante la consulta.
    // En navegación externa (paginación, limpiar o volver), sincroniza el formulario.
    const propia = solicitudes.current.delete(consulta);
    if (ultimaSolicitud.current === `/proveedores${consulta}`) ultimaSolicitud.current = null;
    if (!propia) {
      ultimaSolicitud.current = null;
      solicitudes.current.clear();
      if (temporizador.current !== null) clearTimeout(temporizador.current);
      temporizador.current = null;
      if (texto.current) texto.current.value = filtros.texto ?? '';
      if (tipo.current) tipo.current.value = filtros.tipoRuc ?? '';
    }
  }, [consulta, filtros.texto, filtros.tipoRuc]);

  useEffect(() => () => {
    if (temporizador.current !== null) clearTimeout(temporizador.current);
  }, []);

  function buscar() {
    cancelarEspera();
    const destino = destinoBusquedaProveedores(filtros, texto.current?.value ?? '', tipo.current?.value ?? '');
    if (!destino || destino === ultimaSolicitud.current || (!ultimaSolicitud.current && destino === `/proveedores${consulta}`)) return;
    // También navega al listado actual si hay otra consulta en vuelo: limpiar
    // antes de recibir sus resultados debe cancelar esa navegación anterior.
    ultimaSolicitud.current = destino;
    solicitudes.current.add(destino.slice('/proveedores'.length));
    iniciarTransicion(() => router.replace(destino, { scroll: false }));
  }

  function programar() {
    cancelarEspera();
    if (!componiendo.current) temporizador.current = setTimeout(buscar, ESPERA_BUSQUEDA_PROVEEDORES);
  }

  return <form method="get" action="/proveedores" onSubmit={evento => { evento.preventDefault(); buscar(); }} className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-busy={pendiente}>
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_15rem]">
      <label className="flex flex-col gap-2"><span className="text-xs font-medium text-muted-foreground">Buscar proveedor por nombre o RUC</span><span className="relative"><Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input ref={texto} type="search" name="texto" maxLength={120} defaultValue={filtros.texto ?? ''} placeholder="Escribe al menos 3 letras o dígitos…" aria-describedby="ayuda-busqueda-proveedores" onChange={programar} onCompositionStart={() => { componiendo.current = true; cancelarEspera(); }} onCompositionEnd={() => { componiendo.current = false; programar(); }} className="w-full rounded-lg border border-input bg-background py-3 pl-10 pr-3 text-sm" /></span></label>
      <label className="flex flex-col gap-2"><span className="text-xs font-medium text-muted-foreground">Tipo de RUC</span><select ref={tipo} name="tipoRuc" defaultValue={filtros.tipoRuc ?? ''} onChange={programar} className="rounded-lg border border-input bg-background px-3 py-3 text-sm"><option value="">Todos</option><option value="10">RUC 10 · persona natural</option><option value="20">RUC 20 · persona jurídica</option></select></label>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p id="ayuda-busqueda-proveedores" className="text-xs text-muted-foreground">La búsqueda se actualiza automáticamente desde 3 caracteres. Borra el texto para volver al listado.</p>{filtros.texto || filtros.tipoRuc ? <Link href="/proveedores" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><X size={13} aria-hidden="true" />Quitar filtros</Link> : null}</div>
    <p role="status" aria-live="polite" className="mt-3 flex min-h-5 items-center gap-2 text-xs text-primary">{pendiente ? <><LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Buscando proveedores…</> : filtros.texto ? <>Resultados para: <strong>{filtros.texto}</strong></> : filtros.tipoRuc ? 'Mostrando proveedores del tipo de RUC seleccionado.' : 'Mostrando todos los proveedores.'}</p>
    <noscript><button type="submit" className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Buscar proveedores</button></noscript>
  </form>;
}
