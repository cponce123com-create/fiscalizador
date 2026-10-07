import type { Metadata } from 'next';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

import { TarjetaCifra, Tarjeta, TarjetaContenido, TarjetaEncabezado, TarjetaTitulo } from '@/components/ui/card';
import { Insignia } from '@/components/ui/data';
import { usuarioActual } from '@/lib/auth/session';
// Excepción deliberada a la arquitectura por capas: este panel de solo lectura consulta
// Prisma directamente. Son consultas de presentación (contar y sumar), sin reglas de
// negocio que reutilizar; en cuanto haya lógica que compartir, se mueve a `services/`.
import { prisma } from '@/lib/prisma';
import {
  ETIQUETAS_ESTADO_IMPORTACION,
  formatearFechaHora,
  formatearMonto,
} from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Panel',
};

/**
 * Panel de resumen.
 *
 * Todas las sumas se calculan en PostgreSQL. Enviar las órdenes al navegador
 * para sumarlas allí dejaría de funcionar en cuanto el portal acumule varias
 * gestiones (secciones 22 y 23 del pliego).
 */
export default async function PaginaPanel() {
  const usuario = await usuarioActual();

  const [totalOrdenes, proveedores, importaciones, registrado, anulado, considerado, ultimas] =
    await Promise.all([
      prisma.order.count(),
      prisma.supplier.count(),
      prisma.importBatch.count({
        where: { status: { in: ['COMPLETED', 'COMPLETED_WITH_WARNINGS'] } },
      }),
      prisma.order.aggregate({ _sum: { amount: true } }),
      prisma.order.aggregate({ where: { isCancelled: true }, _sum: { amount: true } }),
      // El monto considerado excluye las anuladas Y los estados que el catálogo
      // marca como que no cuentan económicamente.
      prisma.order.aggregate({
        where: { isCancelled: false, status: { countsEconomically: true } },
        _sum: { amount: true },
      }),
      prisma.importBatch.findMany({
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { version: 'desc' }],
        take: 5,
        select: {
          id: true,
          period: true,
          version: true,
          status: true,
          totalRows: true,
          warningRows: true,
          uploadedAt: true,
          originalFilename: true,
        },
      }),
    ]);

  const registradoTexto = formatearMonto(registrado._sum.amount?.toFixed(2) ?? '0');
  const anuladoTexto = formatearMonto(anulado._sum.amount?.toFixed(2) ?? '0');
  const consideradoTexto = formatearMonto(considerado._sum.amount?.toFixed(2) ?? '0');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">
          {usuario?.name ? `Hola, ${usuario.name}` : 'Panel de control'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Resumen de la información importada desde los libros del Portal de Transparencia.
        </p>
      </div>

      {totalOrdenes === 0 ? (
        <Tarjeta>
          <TarjetaContenido className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="font-medium">Todavía no hay órdenes importadas</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Empieza cargando el primer libro mensual. Podrás revisar la vista previa y los
              hallazgos antes de confirmar nada.
            </p>
            <Link
              href="/admin/importar"
              className="boton-enlace mt-1 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Importar un archivo
            </Link>
          </TarjetaContenido>
        </Tarjeta>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <TarjetaCifra
          etiqueta="Monto considerado"
          valor={consideradoTexto}
          detalle="Excluye órdenes anuladas y estados que no cuentan"
          destacada
        />
        <TarjetaCifra
          etiqueta="Monto registrado"
          valor={registradoTexto}
          detalle="Total de las órdenes, incluidas las anuladas"
        />
        <TarjetaCifra
          etiqueta="Monto anulado"
          valor={anuladoTexto}
          detalle="Órdenes marcadas como anuladas"
        />
        <TarjetaCifra etiqueta="Órdenes" valor={String(totalOrdenes)} />
        <TarjetaCifra etiqueta="Proveedores" valor={String(proveedores)} />
        <TarjetaCifra
          etiqueta="Importaciones completadas"
          valor={String(importaciones)}
        />
      </div>

      <Tarjeta>
        <TarjetaEncabezado>
          <TarjetaTitulo>Últimas importaciones</TarjetaTitulo>
        </TarjetaEncabezado>

        <TarjetaContenido className="p-0">
          {ultimas.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No hay importaciones registradas.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {ultimas.map((lote) => (
                <li key={lote.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {lote.period} · versión {lote.version}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {lote.originalFilename} · {formatearFechaHora(lote.uploadedAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {lote.warningRows > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-warning">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                        {lote.warningRows} advertencia{lote.warningRows === 1 ? '' : 's'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        sin advertencias
                      </span>
                    )}

                    <Insignia
                      tono={
                        lote.status === 'FAILED'
                          ? 'error'
                          : lote.status === 'COMPLETED'
                            ? 'exito'
                            : lote.status === 'COMPLETED_WITH_WARNINGS'
                              ? 'advertencia'
                              : 'neutro'
                      }
                    >
                      {ETIQUETAS_ESTADO_IMPORTACION[lote.status] ?? lote.status}
                    </Insignia>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TarjetaContenido>
      </Tarjeta>
    </div>
  );
}
