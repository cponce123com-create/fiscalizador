import Link from 'next/link';
import { Download, FileSpreadsheet, Database } from 'lucide-react';
import { tituloLibro } from '@/lib/book-download';
import { coberturaLibros, estadoLibro, libroImportado, MESES_LIBROS } from '@/lib/source-books';
import { TarjetaCifra } from '@/components/ui/card';
import { EstadoVacio, Insignia } from '@/components/ui/data';
import { leerConfiguracionPortal } from '@/services/portalService';
import { listarFuentesLibros, type FiltrosLibros } from '@/services/sourceBooksService';
import { claveOriginal, esOriginalPublicado } from '@/services/bookPublicationService';
import { prisma } from '@/lib/prisma';
import { formatearFechaHora } from '@/lib/utils';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Fuentes y cobertura' };

export default async function Fuentes({ searchParams }: { searchParams: Promise<FiltrosLibros> }) {
  const params = await searchParams;
  const [datos, config] = await Promise.all([listarFuentesLibros(params), leerConfiguracionPortal()]);
  const { inventario, lotes, total, pagina, totalPaginas, filtros } = datos;
  const ajustes = await prisma.appSetting.findMany({ where: { key: { in: lotes.filter(libroImportado).map(l => claveOriginal(l.id)) } } });
  const publicados = new Set(ajustes.filter(a => esOriginalPublicado(a.value)).map(a => a.key));
  const anios = [...new Set(inventario.map(b => b.year))];
  const vigentes = inventario.filter(b => libroImportado(b) && b.isCurrent && !b.requiresReview);
  const enlace = (page: number, year = filtros.year, month = filtros.month, tipo: typeof filtros.tipo | null = filtros.tipo) => {
    const query = new URLSearchParams();
    if (year) query.set('year', String(year));
    if (month) query.set('month', String(month));
    if (tipo) query.set('tipo', tipo);
    query.set('page', String(page));
    return `/fuentes?${query.toString()}#libros`;
  };
  return (
    <article className="flex flex-col gap-6">
      <header className="rounded-xl border border-border bg-card p-6">
        <p className="mb-2 text-sm font-medium text-primary">Documentos y procedencia</p>
        <h1 className="text-2xl font-semibold">Fuentes y cobertura</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Consulta los libros cargados de {config.municipio}, sus periodos, resultados de importación y descargas. Los duplicados y las observaciones se gestionan durante la importación; esta página muestra el resultado.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-3">
        <TarjetaCifra etiqueta="Libros cargados" valor={String(inventario.length)} detalle="Incluye todos los estados y versiones" />
        <TarjetaCifra etiqueta="Libros vigentes" valor={String(vigentes.length)} detalle="Versiones incorporadas a los totales" />
        <TarjetaCifra etiqueta="Meses con datos vigentes" valor={String(new Set(vigentes.map(b => `${b.year}-${b.month}`)).size)} detalle="No equivale a información completa del mes" />
      </div>
      <section id="libros" className="flex scroll-mt-6 flex-col gap-4">
        <div><h2 className="text-xl font-semibold">Libros cargados</h2><p className="text-sm text-muted-foreground">{total} libro(s) en este listado. Se muestran también archivos sin importación finalizada y versiones anteriores.</p></div>
        <form action="/fuentes" className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
          <label className="flex flex-col gap-1 text-sm">Año<select name="year" defaultValue={filtros.year ?? ''} className="h-10 rounded-md border border-input bg-background px-3"><option value="">Todos</option>{anios.map(anio => <option key={anio} value={anio}>{anio}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-sm">Mes<select name="month" defaultValue={filtros.month ?? ''} className="h-10 rounded-md border border-input bg-background px-3"><option value="">Todos</option>{MESES_LIBROS.map((mes, i) => <option key={mes} value={i + 1}>{mes}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-sm">Tipo de libro<select name="tipo" defaultValue={filtros.tipo ?? ''} className="h-10 rounded-md border border-input bg-background px-3"><option value="">Todos</option><option value="ORDENES_COMPRA">Órdenes de compra</option><option value="ORDENES_SERVICIO">Órdenes de servicio</option><option value="CONSOLIDADO">Compras y servicios</option></select></label>
          <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Filtrar libros</button>
          <Link href="/fuentes#libros" className="px-2 py-2 text-sm underline">Ver todos</Link>
        </form>
        {lotes.length === 0 ? <EstadoVacio titulo={inventario.length ? 'No hay libros para estos filtros' : 'Todavía no hay libros cargados'} descripcion={inventario.length ? 'Selecciona otro periodo o pulsa Ver todos.' : 'Los archivos aparecerán aquí cuando se carguen en el administrador.'} icono={<FileSpreadsheet className="h-8 w-8" />} /> : null}
        <div className="grid gap-4 lg:grid-cols-2">
          {lotes.map(b => {
            const estado = estadoLibro(b);
            const importado = libroImportado(b);
            return (
              <section key={b.id} id={b.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
                <div className="flex items-start gap-3"><FileSpreadsheet aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-primary" /><h3 className="font-semibold">{tituloLibro(b, config.municipio)}</h3></div>
                <div><Insignia tono={estado.tono}>{estado.etiqueta}</Insignia><p className="mt-2 text-xs text-muted-foreground">{estado.detalle}</p></div>
                <p className="break-words text-sm text-muted-foreground">Archivo recibido: {b.originalFilename}<br />Cargado: {formatearFechaHora(b.uploadedAt)}{b.processingFinishedAt ? <> · Procesado: {formatearFechaHora(b.processingFinishedAt)}</> : null}</p>
                <dl className="grid grid-cols-2 gap-3 rounded-md bg-muted/40 p-3 text-sm sm:grid-cols-4">
                  <div><dt className="text-xs text-muted-foreground">Órdenes importadas</dt><dd className="font-semibold tabular-nums">{b._count.orders}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Observaciones</dt><dd className="font-semibold tabular-nums">{b.warningRows}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Filas con error</dt><dd className="font-semibold tabular-nums">{b.errorRows}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Filas excluidas</dt><dd className="font-semibold tabular-nums">{b.excludedRows}</dd></div>
                </dl>
                {importado ? <div className="flex flex-wrap gap-3 text-sm">
                  <Link className="inline-flex items-center gap-2 font-medium text-primary underline" href={`/api/public/libros/${b.id}?formato=xlsx`}><Download className="h-4 w-4" aria-hidden="true" />Extracto Excel</Link>
                  <Link className="underline" href={`/api/public/libros/${b.id}`}>Extracto CSV</Link>
                  {publicados.has(claveOriginal(b.id)) ? <Link className="underline" href={`/api/public/libros/${b.id}/original`}>Libro original</Link> : null}
                </div> : <p className="text-xs text-muted-foreground">El extracto estará disponible cuando termine la importación.</p>}
                {b.sourceUrl ? <a href={b.sourceUrl} rel="noopener noreferrer" target="_blank" className="text-sm underline">Consultar fuente en Transparencia</a> : null}
                <details className="mt-auto border-t border-border pt-3 text-xs text-muted-foreground"><summary className="cursor-pointer">Procedencia y detalles del libro</summary><div className="mt-2 flex flex-col gap-2">
                  <p>Hoja: {b.sheetName ?? 'Sin hoja registrada'} · Filas leídas: {b.totalRows}</p>
                  <p>Cobertura del documento: {b.coverageComplete ? 'Declarada completa al importar' : 'Sin declaración de integridad'}. El resultado se registra durante la importación.</p>
                  <p className="break-all">Huella SHA-256 del original: {b.checksum}</p>
                  {!b.sourceUrl ? <p>Esta versión no tiene un enlace de procedencia registrado.</p> : null}
                  {!publicados.has(claveOriginal(b.id)) ? <p>La descarga íntegra del original no está habilitada. El administrador puede configurarla en Importaciones.</p> : null}
                </div></details>
              </section>
            );
          })}
        </div>
        {totalPaginas > 1 ? <nav aria-label="Paginación de libros" className="flex items-center justify-between gap-3 text-sm"><span>Página {pagina} de {totalPaginas}</span><div className="flex gap-4">{pagina > 1 ? <Link className="underline" href={enlace(pagina - 1)}>Anterior</Link> : null}{pagina < totalPaginas ? <Link className="underline" href={enlace(pagina + 1)}>Siguiente</Link> : null}</div></nav> : null}
      </section>
      <section className="flex flex-col gap-4">
        <div><h2 className="flex items-center gap-2 text-xl font-semibold"><Database className="h-5 w-5" aria-hidden="true" />Cobertura por mes</h2><p className="mt-1 text-sm text-muted-foreground">Indica qué archivos se cargaron y cuáles se importaron. Un mes sin libro significa información faltante, nunca gasto cero. Un libro importado no garantiza que se hayan publicado todas las órdenes del mes.</p></div>
        {anios.map(anio => <details key={anio} open={anio === (filtros.year ?? anios[0])} className="rounded-lg border border-border bg-card p-4">
          <summary className="cursor-pointer font-semibold">{anio}</summary><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Libros de compras y servicios cargados en {anio}</caption><thead><tr className="border-b border-border"><th scope="col" className="p-3">Mes</th><th scope="col" className="p-3">Compras</th><th scope="col" className="p-3">Servicios</th></tr></thead><tbody>
            {MESES_LIBROS.map((mes, i) => <tr key={mes} className="border-b border-border/50 last:border-0"><th scope="row" className="p-3 font-medium">{mes}</th>{(['ORDENES_COMPRA', 'ORDENES_SERVICIO'] as const).map(tipo => {
              const libros = inventario.filter(b => b.year === anio && b.month === i + 1 && (b.importType === tipo || b.importType === 'CONSOLIDADO'));
              const cobertura = coberturaLibros(libros);
              return <td key={tipo} className="p-3"><Insignia tono={cobertura.tono}>{cobertura.etiqueta}</Insignia>{libros.length ? <Link className="mt-1 block text-xs underline" href={enlace(1, anio, i + 1, null)}>{libros.length} libro(s) · ver archivos</Link> : null}</td>;
            })}</tr>)}
          </tbody></table></div>
        </details>)}
      </section>
      <p className="rounded-lg bg-muted/40 p-4 text-xs text-muted-foreground">Portal ciudadano independiente. Las cifras representan órdenes registradas, no pagos ni presupuesto total. Los extractos Excel y CSV contienen campos públicos normalizados y referencias de fila; el libro original conserva el archivo recibido. Las versiones anteriores no se suman a las vigentes.</p>
    </article>
  );
}
