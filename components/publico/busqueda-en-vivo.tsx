'use client';

import { useEffect, useRef, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { destinoBusqueda } from '@/lib/busqueda-en-vivo';

export function BusquedaEnVivo({ ruta, consulta, children, className }: { ruta: string; consulta: string; children: ReactNode; className?: string }) {
  const router = useRouter();
  const formulario = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const propias = useRef(new Set<string>());
  const ultima = useRef<string | null>(null);
  const componiendo = useRef(false);
  const [pendiente, transicion] = useTransition();
  const normalizar = (valor: string) => { const params = new URLSearchParams(valor); params.delete('pagina'); params.delete('page'); params.sort(); return params.toString(); };
  const actual = normalizar(consulta);

  function cancelar() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  useEffect(() => {
    if (propias.current.delete(actual)) return;
    propias.current.clear();
    ultima.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const params = new URLSearchParams(actual);
    for (const control of Array.from(formulario.current?.elements ?? [])) {
      if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) {
        if (control instanceof HTMLInputElement && control.type === 'checkbox') control.checked = params.getAll(control.name).includes(control.value);
        else if (control.name) control.value = params.get(control.name) ?? (control instanceof HTMLSelectElement ? Array.from(control.options).find(opcion => opcion.defaultSelected)?.value ?? control.options[0]?.value ?? '' : '');
      }
    }
  }, [actual, consulta]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function buscar(manual = false) {
    cancelar();
    const form = formulario.current;
    if (!form) return;
    const valores = new URLSearchParams();
    for (const [nombre, valor] of new FormData(form)) if (typeof valor === 'string') valores.append(nombre, valor);
    const nombres = Array.from(form.elements).flatMap(control => control instanceof HTMLInputElement || control instanceof HTMLSelectElement ? [control.name] : []);
    const destino = destinoBusqueda(ruta, actual, valores, nombres, manual);
    if (!destino || destino === ultima.current || (!ultima.current && destino === `${ruta}${actual ? `?${actual}` : ''}`)) return;
    ultima.current = destino;
    propias.current.add(normalizar(destino.split('?')[1] ?? ''));
    transicion(() => router.replace(destino, { scroll: false }));
  }

  function programar() {
    cancelar();
    if (!componiendo.current) timer.current = setTimeout(() => buscar(), 350);
  }

  return <form ref={formulario} method="get" action={ruta} className={className} aria-busy={pendiente} onChange={programar} onCompositionStart={() => { componiendo.current = true; cancelar(); }} onCompositionEnd={() => { componiendo.current = false; programar(); }} onSubmit={evento => { evento.preventDefault(); buscar(true); }}>
    {children}
    <p role="status" aria-live="polite" className="w-full text-xs text-muted-foreground">{pendiente ? 'Buscando…' : 'Búsqueda automática desde 3 caracteres. Borra el texto para mostrar todos.'}</p>
  </form>;
}
