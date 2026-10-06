import type { Metadata } from 'next';
import { ListOrdered, Search } from 'lucide-react';
import Link from 'next/link';

import { Boton } from '@/components/ui/button';
import {
  Aviso,
  EstadoVacio,
  Insignia,
  Tabla,
  TablaCelda,
  TablaCeldaEncabezado,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from '@/components/ui/data';
import { Campo, Etiqueta, Selector } from '@/components/ui/form';
import type { Prisma } from '@/lib/generated/prisma/client';
import { puede } from '@/lib/auth/permissions';
import { usuarioActual } from '@/lib/auth/session';
// Excepción deliberada a la arquitectura por capas: esta página de solo lectura consulta
// Prisma directamente. Son consultas de presentación (contar, listar y sumar), sin reglas
// de negocio que reutilizar; en cuanto haya lógica que compartir, se mueve a `services/`.
import { prisma } from '@/lib/prisma';
import { formatearFecha, formatearMonto } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Órdenes',
};

const POR_PAGINA = 25;

type CampoOrden = 'issueDate' | 'amount' | 'orderNumber';

function esCampoOrden(valor: string | undefined): valor is CampoOrden {
  return valor === 'issueDate' || valor === 'amount' || valor === 'orderNumber';
}

type Filtros = {
  q: string;
  orderBy: CampoOrden;
  dir: 'asc' | 'desc';
  soloAnuladas: boolean;
};

function enlaceConPagina(filtros: Filtros, pagina: number): string {
  const params = new URLSearchParams();
  if (filtros.q) params.set('q', filtros.q);
  params.set('orderBy', filtros.orderBy);
  params.set('dir', filtros.dir);
  if (filtros.soloAnuladas) params.set('soloAnuladas', '1');
  params.set('page', String(pagina));
  return `/admin/ordenes?${params.toString()}`;
}

/**
 * Tabla de órdenes.
 *
 * La búsqueda, el ordenamiento, la paginación y la suma del filtro se resuelven
 * en PostgreSQL. El navegador recibe solo las 25 filas de la página actual.
 */
export default async function PaginaOrdenes({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; orderBy?: string; dir?: string; soloAnuladas?: string }>;
}) {
  const usuario = await usuarioActual();

  if (!usuario || !puede(usuario.role, 'orders:read')) {
    return (
      <Aviso tono="error" titulo="No tienes permiso para ver las órdenes">
        Tu rol actual es {usuario?.role ?? 'desconocido'}.
      </Aviso>
    );
  }

  const params = await searchParams;

  const filtros: Filtros = {
    q: (params.q ?? '').trim().slice(0, 100),
    orderBy: esCampoOrden(params.orderBy) ? params.orderBy : 'issueDate',
    dir: params.dir === 'asc' ? 'asc' : 'desc',
    soloAnuladas: params.soloAnuladas === '1',
  };

  const pagina = Math.max(1, Number(params.page ?? '1') || 1);

  const where: Prisma.OrderWhereInput = {};

  if (filtros.soloAnuladas) where.isCancelled = true;

  if (filtros.q) {
    where.OR = [
      { orderNumber: { contains: filtros.q, mode: 'insensitive' } },
      { ruc: { contains: filtros.q } },
      { supplier: { name: { contains: filtros.q, mode: 'insensitive' } } },
    ];
  }

  const [ordenes, total, agregado, anuladas] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { [filtros.orderBy]: filtros.dir },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      select: {
        id: true,
        orderNumber: true,
        description: true,
        issueDate: true,
        amount: true,
        isCancelled: true,
        ruc: true,
        sourceRow: true,
        orderType: { select: { code: true } },
        status: { select: { label: true } },
        supplier: { select: { name: true } },
      },
    }),
    prisma.order.count({ where }),
    prisma.order.aggregate({ where, _sum: { amount: true } }),
    prisma.order.count({ where: { ...where, isCancelled: true } }),
  ]);

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Órdenes</h1>
        <p className="text-sm text-muted-foreground">
          Órdenes de compra y de servicio importadas de los libros del Portal de Transparencia.
        </p>
      </div>

      <form method="get" action="/admin/ordenes" className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
          <Etiqueta htmlFor="q">Buscar</Etiqueta>
          <Campo
            id="q"
            name="q"
            type="search"
            defaultValue={filtros.q}
            placeholder="Número de orden, RUC o razón social"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Etiqueta htmlFor="orderBy">Ordenar por</Etiqueta>
          <Selector id="orderBy" name="orderBy" defaultValue={filtros.orderBy}>
            <option value="issueDate">Fecha de emisión</option>
            <option value="amount">Monto</option>
            <option value="orderNumber">Número de orden</option>
          </Selector>
        </div>

        <div className="flex flex-col gap-1.5">
          <Etiqueta htmlFor="dir">Sentido</Etiqueta>
          <Selector id="dir" name="dir" defaultValue={filtros.dir}>
            <option value="desc">Descendente</option>
            <option value="asc">Ascendente</option>
          </Selector>
        </div>

        <label className="flex h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="soloAnuladas"
            value="1"
            defaultChecked={filtros.soloAnuladas}
            className="h-4 w-4 rounded border-input text-primary"
          />
          Solo anuladas
        </label>

        <Boton type="submit" variant="outline">
          <Search className="h-4 w-4" aria-hidden="true" />
          Filtrar
        </Boton>

        {filtros.q || filtros.soloAnuladas ? (
          <Link
            href="/admin/ordenes"
            className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Limpiar
          </Link>
        ) : null}
      </form>

      {ordenes.length === 0 ? (
        <EstadoVacio
          titulo="No hay órdenes para este filtro"
          descripcion={
            filtros.q || filtros.soloAnuladas
              ? 'Prueba con otros criterios de búsqueda o quita los filtros.'
              : 'Cuando importes un libro aparecerán aquí.'
          }
          icono={<ListOrdered className="h-8 w-8" aria-hidden="true" />}
        />
      ) : (
        <>
          <Tabla>
            <TablaEncabezado>
              <TablaFila>
                <TablaCeldaEncabezado>Nº orden</TablaCeldaEncabezado>
                <TablaCeldaEncabezado>Tipo</TablaCeldaEncabezado>
                <TablaCeldaEncabezado>Emisión</TablaCeldaEncabezado>
                <TablaCeldaEncabezado>RUC</TablaCeldaEncabezado>
                <TablaCeldaEncabezado>Proveedor</TablaCeldaEncabezado>
                <TablaCeldaEncabezado>Estado</TablaCeldaEncabezado>
                <TablaCeldaEncabezado className="text-right">Monto</TablaCeldaEncabezado>
              </TablaFila>
            </TablaEncabezado>

            <TablaCuerpo>
              {ordenes.map((orden) => (
                <TablaFila key={orden.id} className={orden.isCancelled ? 'opacity-70' : undefined}>
                  <TablaCelda>
                    <span className="font-medium">{orden.orderNumber}</span>
                    {orden.description ? (
                      <span
                        className="mt-0.5 block max-w-[22rem] truncate text-xs text-muted-foreground"
                        title={orden.description}
                      >
                        {orden.description}
                      </span>
                    ) : null}
                  </TablaCelda>

                  <TablaCelda className="text-xs text-muted-foreground">
                    {orden.orderType?.code ?? '—'}
                  </TablaCelda>

                  <TablaCelda className="tabular">{formatearFecha(orden.issueDate)}</TablaCelda>

                  <TablaCelda className="tabular">{orden.ruc}</TablaCelda>

                  <TablaCelda className="max-w-[18rem] truncate" title={orden.supplier.name}>
                    {orden.supplier.name}
                  </TablaCelda>

                  <TablaCelda>
                    {orden.isCancelled ? (
                      <Insignia tono="error">
                        {orden.status?.label ?? 'Anulada'} · no suma
                      </Insignia>
                    ) : (
                      <Insignia tono="exito">{orden.status?.label ?? '—'}</Insignia>
                    )}
                  </TablaCelda>

                  <TablaCelda className="tabular text-right font-medium">
                    {formatearMonto(orden.amount?.toFixed(2) ?? null)}
                  </TablaCelda>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>

          <nav aria-label="Paginación de órdenes" className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Página {pagina} de {totalPaginas} · {total} orden(es)
              {anuladas > 0 ? ` · ${anuladas} anulada(s)` : ''} · suma del filtro{' '}
              <span className="tabular font-medium text-foreground">
                {formatearMonto(agregado._sum.amount?.toFixed(2) ?? '0')}
              </span>
            </p>

            <div className="flex items-center gap-2">
              {pagina > 1 ? (
                <Link
                  href={enlaceConPagina(filtros, pagina - 1)}
                  className="inline-flex h-9 items-center rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-muted"
                >
                  Anterior
                </Link>
              ) : null}

              {pagina < totalPaginas ? (
                <Link
                  href={enlaceConPagina(filtros, pagina + 1)}
                  className="inline-flex h-9 items-center rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-muted"
                >
                  Siguiente
                </Link>
              ) : null}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
