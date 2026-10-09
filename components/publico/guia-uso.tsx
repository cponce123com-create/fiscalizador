import { FileCheck, Search, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';

const pasos = [
  {
    numero: '1',
    titulo: 'Busca',
    descripcion: 'Escribe un proveedor, RUC, orden o concepto. Desde 3 caracteres la búsqueda se actualiza sola.',
    href: '/ordenes',
    texto: 'Ir a órdenes',
    icono: Search,
  },
  {
    numero: '2',
    titulo: 'Filtra y compara',
    descripcion: 'Acota por año, mes, gestión, tipo de RUC o estado para mirar patrones con más calma.',
    href: '/estadisticas',
    texto: 'Ver estadísticas',
    icono: SlidersHorizontal,
  },
  {
    numero: '3',
    titulo: 'Verifica la fuente',
    descripcion: 'Cada cifra debe poder contrastarse con libros y metodología. Un monto alto no prueba irregularidad.',
    href: '/fuentes',
    texto: 'Ver fuentes',
    icono: FileCheck,
  },
];

export function GuiaUso() {
  return (
    <section aria-labelledby="guia-uso-titulo" className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-primary">Guía rápida</p>
          <h2 id="guia-uso-titulo" className="titulo-editorial text-2xl font-bold">Cómo usar este portal</h2>
        </div>
        <Link href="/metodologia" className="boton-enlace inline-flex w-fit items-center rounded-lg px-3 py-2 text-xs text-primary">
          Entender la metodología
        </Link>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {pasos.map((paso) => {
          const Icono = paso.icono;
          return (
            <article key={paso.numero} className="flex min-w-0 gap-3 rounded-xl border border-border/80 bg-muted/30 p-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {paso.numero}
              </span>
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Icono size={15} aria-hidden="true" />
                  {paso.titulo}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{paso.descripcion}</p>
                <Link href={paso.href} className="mt-2 inline-block text-xs font-semibold text-primary underline underline-offset-4">
                  {paso.texto}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
