import { Landmark } from 'lucide-react';
import Link from 'next/link';

import { NavPublica } from '@/components/publico/nav-publica';

/**
 * Armazón del portal público.
 *
 * Vive en el grupo `(public)`, que no cambia la URL: `app/(public)/page.tsx` sirve
 * la raíz. El grupo existe para separar el portal ciudadano del panel de
 * administración, que tiene su propio armazón y exige sesión.
 */
export default function LayoutPublico({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <Link href="/" className="flex items-start gap-3 rounded-md">
              <Landmark className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
              <span className="flex flex-col">
                <span className="text-base font-semibold leading-tight">
                  Portal de Transparencia
                </span>
                <span className="text-sm text-muted-foreground">
                  Órdenes de compra y de servicio
                </span>
              </span>
            </Link>

            <Link
              href="/admin"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Panel de administración
            </Link>
          </div>

          <NavPublica />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:px-6">
          <p>
            Datos obtenidos de los libros mensuales del Portal de Transparencia. Cada registro
            conserva el contenido original del archivo del que procede.
          </p>
          <p>
            Las órdenes anuladas se muestran pero no se suman al monto considerado.{' '}
            <Link href="/metodologia" className="underline underline-offset-2 hover:text-foreground">
              Ver metodología
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
