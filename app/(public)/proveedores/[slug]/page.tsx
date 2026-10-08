import { Compartir } from '@/components/publico/compartir';
import { imagenCompartida, metadataCompartida, resumenProveedor } from '@/lib/compartir';
import { catalogoPrensa } from '@/lib/prensa';
import { antecedentesElectoralesProveedor, informacionDocumentadaProveedor } from '@/services/electoralService';
import { AntecedentesElectorales } from '@/components/publico/antecedentes-electorales';
import { prisma } from '@/lib/prisma';
import { datosPublicosProveedor, fuentesPublicasProveedor } from '@/lib/perfil-publico-proveedor';
import type { Metadata } from 'next';
import { ArrowLeft, Building2 } from 'lucide-react';
import { Info } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { GraficoBarras, type BarraGrafico } from '@/components/publico/grafico-barras';
import { GraficoEvolucion, type PuntoGrafico } from '@/components/publico/grafico-evolucion';
import { Paginacion } from '@/components/publico/paginacion';
import { TablaOrdenes } from '@/components/publico/tabla-ordenes';
import { Aviso, Insignia } from '@/components/ui/data';
import { Seccion } from '@/components/ui/seccion';
import { leerFiltros } from '@/lib/filtros';
import { formatearFecha, formatearMonto } from '@/lib/utils';
import { listarOrdenes, perfilProveedor } from '@/services/statisticsService';

/**
 * Perfil público de un proveedor.
 *
 * Reúne lo que el pliego pide para esta pantalla: los tres montos separados, el
 * periodo en que aparece, su reparto por gestión, año y mes, y el listado completo
 * de sus órdenes. El perfil se busca por `slug` —legible y estable— y no por el
 * identificador interno.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const perfil = await perfilProveedor(slug);

  if (!perfil) return { title: 'Proveedor no encontrado' };

  return metadataCompartida(perfil.nombre, resumenProveedor(perfil.nombre, perfil.ordenes, perfil.totalConsiderado), `/proveedores/${encodeURIComponent(slug)}`, imagenCompartida('proveedor', slug));
}

export default async function PaginaProveedor({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const perfil = await perfilProveedor(slug);

  if (!perfil) notFound();

  const ficha = await prisma.supplierProfile.findUnique({ where: { supplierId: perfil.id }, select: { isPublic: true, publication: true, birthplace: true, publicDistrict: true, birthDate: true, photoKey: true, updatedAt: true } });
  const datos = datosPublicosProveedor(perfil.ruc, ficha, perfil.id);
  const foto = datos.foto;
  const [electoral, evidencia] = await Promise.all([antecedentesElectoralesProveedor(perfil.ruc), informacionDocumentadaProveedor(perfil.id)]);

  // El proveedor se fija aquí, no se toma de la URL: así el parámetro `proveedor`
  // no puede usarse para mezclar órdenes de dos proveedores en la misma pantalla.
  const filtros = { ...leerFiltros(await searchParams), proveedorId: perfil.id };
  const ordenes = await listarOrdenes(filtros);

  // Los enlaces de paginación no repiten el identificador: ya está en la ruta.
  const filtrosEnlaces = { ...filtros, proveedorId: null };

  const evolucionDegenerada = perfil.porAnio.length < 2 && perfil.porMes.length < 2;

  const barrasGestion: BarraGrafico[] = perfil.porGestion.map((fila) => ({
    etiqueta: `Gestión ${fila.etiqueta}`,
    valor: Number(fila.considerado),
    exacto: fila.considerado,
    detalle: `${fila.ordenes} ${fila.ordenes === 1 ? 'orden' : 'órdenes'}`,
  }));

  const puntosAnuales: PuntoGrafico[] = perfil.porAnio.map((punto) => ({
    periodo: punto.etiqueta,
    valor: Number(punto.considerado),
    exacto: punto.considerado,
    ordenes: punto.ordenes,
  }));

  const puntosMensuales: PuntoGrafico[] = perfil.porMes.map((punto) => ({
    periodo: punto.etiqueta,
    valor: Number(punto.considerado),
    exacto: punto.considerado,
    ordenes: punto.ordenes,
  }));

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/proveedores"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Todos los proveedores
      </Link>

      <Compartir titulo={perfil.nombre} resumen={resumenProveedor(perfil.nombre, perfil.ordenes, perfil.totalConsiderado)} ruta={`/proveedores/${encodeURIComponent(slug)}`} imagen={imagenCompartida('proveedor', slug)} />
      <div className="flex flex-col gap-5 rounded-lg border border-border bg-card p-6 sm:flex-row sm:items-center">
        {foto ? (
          <Image
            unoptimized={Boolean(datos.foto)}
            src={foto}
            alt={`Fotografía de ${perfil.nombre}`}
            width={96}
            height={128}
            className="h-32 w-24 shrink-0 rounded-lg object-cover object-top"
          />
        ) : (
          <span
            className="flex h-32 w-24 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
            aria-hidden="true"
          >
            <Building2 className="h-10 w-10" />
          </span>
        )}

        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold sm:text-2xl">{perfil.nombre}</h1>
          <p className="tabular text-sm text-muted-foreground">RUC {perfil.ruc}</p>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {datos.dni ? <div><dt className="text-muted-foreground">DNI</dt><dd>{datos.dni}</dd></div> : null}
            {datos.edad !== null ? <div><dt className="text-muted-foreground">Edad</dt><dd>{datos.edad === null ? 'Sin registrar' : `${datos.edad} años`}</dd></div> : null}
            <div><dt className="text-muted-foreground">{datos.dni ? 'Lugar de nacimiento' : 'Lugar de origen'}</dt><dd>{datos.nacimiento ?? 'Sin registrar'}</dd></div>
            <div><dt className="text-muted-foreground">Dirección · distrito</dt><dd>{datos.distrito ?? 'Sin registrar'}</dd></div>
          </dl>
          <div className="flex flex-wrap gap-3 text-xs">{fuentesPublicasProveedor(ficha).map(f => <Link key={f.campo} href={f.url} target="_blank" rel="noopener noreferrer" className="underline">Fuente de {f.campo} · revisada {f.revisado.slice(0, 10)}</Link>)}</div>
          <div className="flex flex-wrap items-center gap-2">
            <Insignia tono="neutro">{perfil.tipo}</Insignia>
            {perfil.anuladas > 0 ? (
              <Insignia tono="error">
                {perfil.anuladas} {perfil.anuladas === 1 ? 'orden anulada' : 'órdenes anuladas'} · no
                suma{perfil.anuladas === 1 ? '' : 'n'}
              </Insignia>
            ) : null}
          </div>
        </div>
      </div>

      {catalogoPrensa.some(p => p.ruc === perfil.ruc) ? <Link href="/prensa" className="boton-enlace inline-flex min-h-11 w-fit items-center rounded-lg border border-border px-4 py-2 text-sm font-semibold text-primary">← ¿Y la prensa cuánto cobra? · Ver listado de seguimiento</Link> : null}

      {electoral ? <section className="flex flex-col gap-4"><h2 className="text-xl font-semibold">Antecedentes electorales</h2><Link href={`/electoral/${electoral.id}`} className="text-sm text-primary underline">Ver perfil electoral de {electoral.fullName}</Link><AntecedentesElectorales registros={electoral.records} /><p className="text-xs text-muted-foreground">Coincidencia por documento con el RUC 10. Los datos corresponden a las elecciones citadas; no demuestran por sí solos un conflicto de intereses.</p></section> : null}
      {evidencia?.notas ? <section className="rounded-lg border border-border bg-card p-5"><h2 className="text-xl font-semibold">Notas documentadas de fiscalización</h2><p className="mt-3 whitespace-pre-wrap text-sm">{evidencia.notas}</p><Link href={evidencia.fuente!} target="_blank" rel="noopener noreferrer" className="mt-3 block text-sm text-primary underline">Consultar fuente de las notas</Link></section> : null}
      {evidencia?.vinculos.length ? <section className="flex flex-col gap-4"><h2 className="text-xl font-semibold">Personas y vínculos documentados</h2><p className="text-xs text-muted-foreground">Relaciones registradas y contrastadas por la administración con las fuentes citadas. No constituyen una conclusión de nepotismo o incompatibilidad.</p><div className="grid gap-3 sm:grid-cols-2">{evidencia.vinculos.map(c => <article key={c.id} className="rounded-lg border border-border bg-card p-4"><h3 className="font-semibold">{c.fullName}</h3><p className="mt-2 text-sm">Vínculo: {c.relationship}</p>{c.publicNote ? <p className="mt-2 whitespace-pre-wrap text-sm">{c.publicNote}</p> : null}<Link href={c.source!} target="_blank" rel="noopener noreferrer" className="mt-3 block text-sm text-primary underline">Consultar fuente del vínculo</Link></article>)}</div></section> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-primary/30 bg-card p-6 shadow-sm ring-1 ring-primary/15 lg:col-span-2">
          <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground" title="Suma de órdenes vigentes según el catálogo de estados. No incluye anuladas ni estados no económicos.">
            Monto considerado <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </p>
          <p className="tabular mt-2 text-4xl font-semibold text-primary sm:text-5xl">
            {formatearMonto(perfil.totalConsiderado)}
          </p>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Es el monto de órdenes considerado, no pagos acreditados. Excluye anuladas y estados no económicos.
          </p>
        </div>

        <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-6 shadow-sm">
          <div>
            <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground" title="Órdenes anuladas o que no cuentan económicamente. Se conservan para trazabilidad, pero no suman al monto considerado.">
              Órdenes anuladas <Info className="h-3.5 w-3.5" aria-hidden="true" />
            </p>
            <p className="tabular mt-2 text-2xl font-semibold text-foreground">
              {perfil.anuladas.toLocaleString('es-PE')}
            </p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {perfil.anuladas === 1
              ? '1 orden anulada. Se conserva como trazabilidad, pero su importe agregado no se publica.'
              : `${perfil.anuladas} órdenes anuladas. Se conservan como trazabilidad, pero su importe agregado no se publica.`}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Dato etiqueta="Órdenes" valor={perfil.ordenes.toLocaleString('es-PE')} detalle="Registros encontrados en los libros vigentes disponibles." />
        <Dato
          etiqueta="Primera aparición"
          valor={perfil.primeraAparicion ? formatearFecha(perfil.primeraAparicion) : '—'}
        />
        <Dato
          etiqueta="Última aparición"
          valor={perfil.ultimaAparicion ? formatearFecha(perfil.ultimaAparicion) : '—'}
        />
        <Dato
          etiqueta="Años con registros"
          valor={perfil.aniosPresentes.length > 0 ? perfil.aniosPresentes.join(', ') : '—'}
        />
      </div>

      <Seccion
        titulo="Gasto por gestión"
        descripcion="Reparto del monto considerado entre los periodos de gobierno."
      >
        <GraficoBarras barras={barrasGestion} etiquetaSerie="Monto considerado" />
      </Seccion>

      <Seccion
        titulo="Evolución del gasto"
        descripcion="Comparación entre años y entre meses."
      >
        {evolucionDegenerada ? (
          <Aviso tono="info" titulo="Todavía no hay evolución que mostrar">
            Este proveedor solo aparece en un periodo, así que no hay tendencia que comparar. La
            vista se completará al importar libros de otros meses o años.
          </Aviso>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <GraficoEvolucion
              puntos={puntosMensuales}
              etiquetaSerie="Monto considerado"
              nombrePeriodo="mes"
            />
            <GraficoEvolucion
              puntos={puntosAnuales}
              etiquetaSerie="Monto considerado"
              nombrePeriodo="año"
            />
          </div>
        )}
      </Seccion>

      <Seccion
        titulo="Órdenes registradas"
        descripcion="Todas las órdenes del proveedor, incluidas las anuladas."
      >
        <Paginacion
          filtros={filtrosEnlaces}
          total={ordenes.total}
          ruta={`/proveedores/${slug}`}
        />

        <TablaOrdenes ordenes={ordenes.filas} mostrarProveedor={false} />

        <Paginacion
          filtros={filtrosEnlaces}
          total={ordenes.total}
          ruta={`/proveedores/${slug}`}
        />
      </Seccion>
    </div>
  );
}

function Dato({
  etiqueta,
  valor,
  detalle,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
      <p className="tabular mt-2 text-2xl font-semibold text-foreground">{valor}</p>
      {detalle ? <p className="mt-1 text-xs text-muted-foreground">{detalle}</p> : null}
    </div>
  );
}
