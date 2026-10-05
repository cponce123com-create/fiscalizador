import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';

import { FormularioLogin } from '@/components/admin/formulario-login';
import { Tarjeta, TarjetaContenido, TarjetaEncabezado, TarjetaDescripcion, TarjetaTitulo } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Acceso al panel',
};

/**
 * Página de acceso.
 *
 * Vive fuera del grupo `(panel)`, así que NO hereda el layout que exige sesión.
 * Si estuviera dentro, el layout redirigiría aquí y esta página redirigiría
 * otra vez: un bucle.
 */
export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <ShieldCheck className="h-9 w-9 text-primary" aria-hidden="true" />
          <h1 className="text-xl font-semibold">Portal de Transparencia</h1>
          <p className="text-sm text-muted-foreground">
            Órdenes de compra y de servicio
          </p>
        </div>

        <Tarjeta>
          <TarjetaEncabezado>
            <TarjetaTitulo>Acceso al panel</TarjetaTitulo>
            <TarjetaDescripcion>
              Área restringida para la administración de la información importada.
            </TarjetaDescripcion>
          </TarjetaEncabezado>

          <TarjetaContenido>
            <FormularioLogin callbackUrl={callbackUrl ?? '/admin'} />
          </TarjetaContenido>
        </Tarjeta>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Los datos publicados provienen de los libros del Portal de Transparencia y se conservan
          sin alteración.
        </p>
      </div>
    </main>
  );
}
