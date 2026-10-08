import { Prisma } from '@/lib/generated/prisma/client';
import { palabrasBusqueda } from './busqueda-ordenes';

/** Nombre y RUC con valores parametrizados; los símbolos no son comodines. */
export function coincideProveedor(texto: string) {
  const palabras = palabrasBusqueda(texto);
  return Prisma.sql`(
    ${texto} = '' OR strpos(lower(s.name), lower(${texto})) > 0
    OR strpos(s.ruc, ${texto}) > 0
    OR (${palabras.length} > 0 AND NOT EXISTS (
      SELECT 1 FROM unnest(${palabras}::text[]) AS buscada(palabra)
      WHERE strpos(translate(lower(s.name), 'áéíóúüñ', 'aeiouun'), buscada.palabra) = 0
    ))
  )`;
}
