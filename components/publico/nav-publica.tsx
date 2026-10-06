'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

/**
 * Navegación pública.
 *
 * Enlaza todas las secciones del portal ciudadano: Inicio, Órdenes, Proveedores,
 * Ranking, Historial, Estadísticas, Vínculos y Metodología. Si se añade una sección
 * nueva, hay que añadirla aquí: una página que no se enlaza no existe para el
 * ciudadano.
 */
const ENLACES = [
  { href: '/', etiqueta: 'Inicio' },
  { href: '/ordenes', etiqueta: 'Órdenes' },
  { href: '/proveedores', etiqueta: 'Proveedores' },
  { href: '/ranking', etiqueta: 'Ranking' },
  { href: '/historial', etiqueta: 'Historial' },
  { href: '/estadisticas', etiqueta: 'Estadísticas' },
  { href: '/vinculos', etiqueta: 'Vínculos' },
  { href: '/fuentes', etiqueta: 'Fuentes y cobertura' },
  { href: '/metodologia', etiqueta: 'Metodología' },
] as const;

export function NavPublica() {
  const ruta = usePathname();

  return (
    <nav aria-label="Secciones del portal" className="flex flex-wrap items-center gap-1">
      {ENLACES.map((enlace) => {
        const activo = enlace.href === '/' ? ruta === '/' : ruta.startsWith(enlace.href);

        return (
          <Link
            key={enlace.href}
            href={enlace.href}
            aria-current={activo ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activo
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {enlace.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
