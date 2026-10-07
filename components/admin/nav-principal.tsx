'use client';

import {
  FileSpreadsheet,
  LayoutDashboard,
  ListOrdered,
  Settings2,
  Tags,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

/**
 * Navegación del panel.
 *
 * Es un componente de cliente porque necesita `usePathname` para resaltar la
 * sección activa. Solo cruza la frontera servidor/cliente una lista de cadenas
 * con los permisos del usuario: nada de funciones ni elementos de React, que
 * complicarían la serialización sin aportar nada.
 */

type Enlace = {
  href: string;
  etiqueta: string;
  icono: LucideIcon;
  /** Permiso necesario para ver el enlace; `null` si es para cualquiera con sesión. */
  permiso: string | null;
};

const ENLACES: readonly Enlace[] = [
  { href: '/admin/apariencia', etiqueta: 'Apariencia y titulares', icono: Settings2, permiso: 'settings:manage' },
  { href: '/admin', etiqueta: 'Panel', icono: LayoutDashboard, permiso: null },
  { href: '/admin/importar', etiqueta: 'Importar', icono: Upload, permiso: 'imports:write' },
  {
    href: '/admin/importaciones',
    etiqueta: 'Importaciones',
    icono: FileSpreadsheet,
    permiso: 'imports:read',
  },
  {
    href: '/admin/catalogos',
    etiqueta: 'Catálogos',
    icono: Settings2,
    permiso: 'imports:write',
  },
  { href: '/admin/ordenes', etiqueta: 'Órdenes', icono: ListOrdered, permiso: 'orders:read' },
  { href: '/admin/proveedores', etiqueta: 'Perfiles de proveedores', icono: Users, permiso: 'persons:read' },
  { href: '/admin/electoral', etiqueta: 'Registro electoral', icono: Users, permiso: 'persons:read' },
  { href: '/admin/personas', etiqueta: 'Personas', icono: Users, permiso: 'persons:read' },
  { href: '/admin/etiquetas', etiqueta: 'Etiquetas', icono: Tags, permiso: 'persons:read' },
];

export function NavPrincipal({ permisos }: { permisos: readonly string[] }) {
  const ruta = usePathname();

  const visibles = ENLACES.filter((e) => e.permiso === null || permisos.includes(e.permiso));

  return (
    <nav aria-label="Secciones del panel" className="flex flex-wrap items-center gap-1">
      {visibles.map((enlace) => {
        // "/admin" es prefijo de todas las demás, así que se compara exacto.
        const activo = enlace.href === '/admin' ? ruta === '/admin' : ruta.startsWith(enlace.href);
        const Icono = enlace.icono;

        return (
          <Link
            key={enlace.href}
            href={enlace.href}
            aria-current={activo ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              activo
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icono className="h-4 w-4" aria-hidden="true" />
            {enlace.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
