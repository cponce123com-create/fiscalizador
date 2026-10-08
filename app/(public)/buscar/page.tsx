import type { Metadata } from 'next';
import { BusquedaPortada } from '@/components/publico/busqueda-portada';
import { leerFiltros } from '@/lib/filtros';
import { buscarEnPortal } from '@/services/searchService';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Buscar proveedores y compras' };

export default async function PaginaBusqueda({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const texto = leerFiltros(await searchParams).texto ?? '';
  const resultado = await buscarEnPortal(texto);
  return <div className="flex flex-col gap-4">
    <header><h1 className="text-2xl font-semibold sm:text-3xl">Buscar proveedores y compras</h1><p className="mt-2 text-sm text-muted-foreground">Primero los proveedores que coinciden por nombre o RUC; después, las órdenes y lo que se compró.</p></header>
    <BusquedaPortada key={texto} textoInicial={texto} resultadoInicial={texto.length >= 3 ? resultado : null} />
  </div>;
}
