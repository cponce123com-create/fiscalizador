import type { Metadata } from 'next';
import { Info } from 'lucide-react';

import { ImportacionPorLotes } from '@/components/admin/importacion-por-lotes';
import { Aviso } from '@/components/ui/data';
import { puede } from '@/lib/auth/permissions';
import { usuarioActual } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Importar',
};

export default async function PaginaImportar() {
  const usuario = await usuarioActual();

  // El enlace del menú ya se oculta sin permiso, pero la ruta es accesible por
  // URL: hay que comprobarlo también aquí.
  if (!usuario || !puede(usuario.role, 'imports:write')) {
    return (
      <Aviso tono="error" titulo="No tienes permiso para importar">
        Cargar un libro nuevo cambia las cifras públicas del portal, así que requiere rol ADMIN o
        SUPERADMIN. Tu rol actual es {usuario?.role ?? 'desconocido'}.
      </Aviso>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Importar libros</h1>
        <p className="text-sm text-muted-foreground">
          Arrastra los libros mensuales del Portal de Transparencia, todos los que necesites de una
          vez. El periodo de cada uno se deduce de sus fechas de emisión. Primero se analizan y se
          muestra una vista previa; nada se guarda hasta que lo confirmes.
        </p>
      </div>

      <Aviso tono="info" titulo="Cómo funciona" icono={<Info className="h-4 w-4" />}>
        El archivo original de cada libro se conserva íntegro y cada registro guarda su contenido tal
        como venía en el libro. Los valores que no se puedan interpretar no se corrigen ni se
        descartan: quedan marcados para que los revises. Si un libro falla, los demás se importan
        igual.
      </Aviso>

      <ImportacionPorLotes />
    </div>
  );
}
