import type { Metadata } from 'next';
import { FileSpreadsheet, Info } from 'lucide-react';
import Link from 'next/link';

import { accionEliminarImportacion, accionPublicarOriginal, accionEliminarTodasImportaciones } from '@/app/admin/importaciones/actions';
import { FormularioAccion } from '@/components/admin/formulario-accion';
import { Aviso, EstadoVacio, Insignia, Tabla, TablaCelda, TablaCeldaEncabezado, TablaCuerpo, TablaEncabezado, TablaFila } from '@/components/ui/data';
import { puede } from '@/lib/auth/permissions';
import { usuarioActual } from '@/lib/auth/session';
// Excepción deliberada a la arquitectura por capas: esta página de solo lectura consulta
// Prisma directamente. Son consultas de presentación (listar y contar lotes), sin reglas
// de negocio que reutilizar; en cuanto haya lógica que compartir, se mueve a `services/`.
import { tituloLibro } from '@/lib/book-download';
import { leerConfiguracionPortal } from '@/services/portalService';
import { claveOriginal, esOriginalPublicado } from '@/services/bookPublicationService';
import { CONFIRMACION_BORRADO_MASIVO, resumenBorradoImportaciones } from '@/services/bulkImportDeletionService';
import { prisma } from '@/lib/prisma';
import {
  ETIQUETAS_ESTADO_IMPORTACION,
  ETIQUETAS_TIPO_IMPORTACION,
  formatearFechaHora,
} from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Importaciones',
};

const POR_PAGINA = 20;

const TONO_POR_ESTADO: Record<string, 'exito' | 'advertencia' | 'error' | 'neutro'> = {
  COMPLETED: 'exito',
  COMPLETED_WITH_WARNINGS: 'advertencia',
  FAILED: 'error',
  VALIDATING: 'neutro',
  PROCESSING: 'neutro',
  UPLOADED: 'neutro',
};

export default async function PaginaImportaciones({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const usuario = await usuarioActual();

  if (!usuario || !puede(usuario.role, 'imports:read')) {
    return (
      <Aviso tono="error" titulo="No tienes permiso para ver las importaciones">
        Tu rol actual es {usuario?.role ?? 'desconocido'}.
      </Aviso>
    );
  }

  const puedeEscribir = puede(usuario.role, 'imports:write');

  const { page } = await searchParams;
  const pagina = Math.max(1, Number(page ?? '1') || 1);

  const [lotes, total] = await Promise.all([
    prisma.importBatch.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { version: 'desc' }],
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      select: {
        id: true,
        year: true,
        month: true,
        originalFilename: true,
        period: true,
        version: true,
        importType: true,
        status: true,
        totalRows: true,
        successfulRows: true,
        warningRows: true,
        errorRows: true,
        uploadedAt: true,
        processingFinishedAt: true,
        errorMessage: true,
        uploadedBy: { select: { email: true } },
        managementPeriod: { select: { name: true } },
        _count: { select: { orders: true } },
      },
    }),
    prisma.importBatch.count(),
  ]);

  const [config, ajustes] = await Promise.all([
    leerConfiguracionPortal(),
    prisma.appSetting.findMany({ where: { key: { in: lotes.map(l => claveOriginal(l.id)) } } }),
  ]);
  const publicados = new Set(ajustes.filter(a => esOriginalPublicado(a.value)).map(a => a.key));
  const borrado = puedeEscribir ? await resumenBorradoImportaciones() : null;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Importaciones</h1>
        <p className="text-sm text-muted-foreground">
          Historial de libros cargados. Cada intento queda registrado, incluso los fallidos, y solo se
          puede eliminar una importación a propósito: la baja también queda en la auditoría.
        </p>
      </div>

      {puedeEscribir ? (
        <Aviso tono="info" titulo="Qué hace eliminar una importación" icono={<Info className="h-4 w-4" />}>
          Se borran sus órdenes, sus columnas, sus hallazgos y el archivo original, y se rehacen los
          resúmenes de los proveedores que tocaba, para que el portal no siga sumando órdenes que ya no
          existen. Los proveedores que se queden sin ninguna orden se borran también, salvo que tengan
          órdenes en otra importación, un vínculo declarado, una fotografía o un perfil privado. No se puede deshacer.
        </Aviso>
      ) : null}

      {borrado && borrado.lotes > 0 ? (
        <details className="rounded-lg border border-destructive/40 bg-card p-4">
          <summary className="cursor-pointer font-medium text-destructive">Eliminar todas las importaciones</summary>
          <p className="my-3 text-sm">Se eliminarán {borrado.lotes} libros de todos los periodos, sus {borrado.ordenes} órdenes, columnas, hallazgos, resúmenes y archivos originales. Se conservan los proveedores y sus perfiles, fotos y vínculos. No se puede deshacer.</p>
          <FormularioAccion key={borrado.huella} accion={accionEliminarTodasImportaciones} etiqueta="Eliminar todas las importaciones" variante="destructive" confirmar={`¿Eliminar definitivamente ${borrado.lotes} importaciones y ${borrado.ordenes} órdenes?`}>
            <input type="hidden" name="huella" value={borrado.huella} />
            <label className="flex max-w-xl flex-col gap-2 text-sm">Para confirmar, escribe {CONFIRMACION_BORRADO_MASIVO}<input required name="confirmacion" autoComplete="off" className="h-10 rounded-md border border-input bg-background px-3" /></label>
          </FormularioAccion>
        </details>
      ) : null}

      {lotes.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no se ha importado ningún libro"
          descripcion="Cuando importes el primer archivo aparecerá aquí, con sus cifras y sus hallazgos."
          icono={<FileSpreadsheet className="h-8 w-8" aria-hidden="true" />}
        >
          <Link
            href="/admin/importar"
            className="boton-enlace mt-1 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Importar un archivo
          </Link>
        </EstadoVacio>
      ) : (
        <Tabla>
          <TablaEncabezado>
            <TablaFila>
              <TablaCeldaEncabezado>Periodo</TablaCeldaEncabezado>
              <TablaCeldaEncabezado>Versión</TablaCeldaEncabezado>
              <TablaCeldaEncabezado>Archivo</TablaCeldaEncabezado>
              <TablaCeldaEncabezado>Tipo</TablaCeldaEncabezado>
              <TablaCeldaEncabezado className="text-right">Filas</TablaCeldaEncabezado>
              <TablaCeldaEncabezado className="text-right">Importadas</TablaCeldaEncabezado>
              <TablaCeldaEncabezado className="text-right">Avisos</TablaCeldaEncabezado>
              <TablaCeldaEncabezado className="text-right">Errores</TablaCeldaEncabezado>
              <TablaCeldaEncabezado>Estado</TablaCeldaEncabezado>
              <TablaCeldaEncabezado>Subido por</TablaCeldaEncabezado>
              {puedeEscribir ? <TablaCeldaEncabezado>Descarga original / eliminar</TablaCeldaEncabezado> : null}
            </TablaFila>
          </TablaEncabezado>

          <TablaCuerpo>
            {lotes.map((lote) => (
              <TablaFila key={lote.id}>
                <TablaCelda>
                  <span className="font-medium">{lote.period}</span>
                  {lote.managementPeriod ? (
                    <span className="block text-xs text-muted-foreground">
                      Gestión {lote.managementPeriod.name}
                    </span>
                  ) : null}
                </TablaCelda>

                <TablaCelda className="tabular">{lote.version}</TablaCelda>

                <TablaCelda className="min-w-64 max-w-[24rem]" title={lote.originalFilename}>
                  {tituloLibro(lote, config.municipio)}
                  <span className="block text-xs text-muted-foreground">Original: {lote.originalFilename}</span>
                </TablaCelda>

                <TablaCelda className="text-xs text-muted-foreground">
                  {ETIQUETAS_TIPO_IMPORTACION[lote.importType] ?? lote.importType}
                </TablaCelda>

                <TablaCelda className="tabular text-right">{lote.totalRows}</TablaCelda>
                <TablaCelda className="tabular text-right font-medium">
                  {lote._count.orders}
                </TablaCelda>
                <TablaCelda className="tabular text-right">
                  {lote.warningRows > 0 ? (
                    <span className="text-warning">{lote.warningRows}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TablaCelda>
                <TablaCelda className="tabular text-right">
                  {lote.errorRows > 0 ? (
                    <span className="text-destructive">{lote.errorRows}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TablaCelda>

                <TablaCelda>
                  <Insignia tono={TONO_POR_ESTADO[lote.status] ?? 'neutro'}>
                    {ETIQUETAS_ESTADO_IMPORTACION[lote.status] ?? lote.status}
                  </Insignia>
                  {lote.errorMessage ? (
                    <span className="mt-1 block max-w-[20rem] text-xs text-destructive">
                      {lote.errorMessage}
                    </span>
                  ) : null}
                </TablaCelda>

                <TablaCelda className="text-xs text-muted-foreground">
                  <span className="block">{lote.uploadedBy?.email ?? '—'}</span>
                  <span className="block">{formatearFechaHora(lote.uploadedAt)}</span>
                </TablaCelda>

                {puedeEscribir ? (
                  <TablaCelda>
                    <details className="mb-3">
                      <summary className="cursor-pointer text-xs font-medium">Original: {publicados.has(claveOriginal(lote.id)) ? 'publicado' : 'privado'}</summary>
                      <FormularioAccion accion={accionPublicarOriginal} etiqueta="Guardar descarga" size="sm" className="mt-3 w-72 gap-3">
                        <input type="hidden" name="importBatchId" value={lote.id} />
                        <label className="flex gap-2 text-xs"><input type="checkbox" name="publicarOriginal" defaultChecked={publicados.has(claveOriginal(lote.id))} />Permitir descargar el archivo original</label>
                        <label className="flex gap-2 text-xs"><input type="checkbox" name="revisionOriginal" />Revisé todas las hojas y columnas y pueden publicarse íntegramente.</label>
                        <p className="text-xs text-muted-foreground">El original conserva todas sus hojas. Las columnas restringidas bloquean esta descarga. El extracto público sigue disponible.</p>
                      </FormularioAccion>
                    </details>
                    {lote.status === 'PROCESSING' ? (
                      <span className="text-xs text-muted-foreground">en proceso</span>
                    ) : (
                      <details>
                        <summary className="cursor-pointer text-xs font-medium text-destructive hover:underline">
                          Eliminar
                        </summary>

                        <div className="mt-3 w-72">
                          <FormularioAccion
                            accion={accionEliminarImportacion}
                            etiqueta="Eliminar importación"
                            variante="destructive"
                            size="sm"
                            className="gap-3"
                            confirmar={`¿Eliminar la importación ${lote.period} v${lote.version}? Se borrarán sus ${lote._count.orders} orden(es) y el archivo original. No se puede deshacer.`}
                          >
                            <input type="hidden" name="importBatchId" value={lote.id} />

                            <label className="flex items-start gap-2 text-xs text-muted-foreground">
                              <input
                                type="checkbox"
                                name="borrarProveedores"
                                defaultChecked
                                className="mt-0.5 h-4 w-4 shrink-0 rounded border-input text-primary"
                              />
                              Borrar también los proveedores que se queden sin ninguna orden
                            </label>
                          </FormularioAccion>
                        </div>
                      </details>
                    )}
                  </TablaCelda>
                ) : null}
              </TablaFila>
            ))}
          </TablaCuerpo>
        </Tabla>
      )}

      {totalPaginas > 1 ? (
        <nav aria-label="Paginación de importaciones" className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Página {pagina} de {totalPaginas} · {total} importación(es)
          </p>

          <div className="flex items-center gap-2">
            {pagina > 1 ? (
              <Link
                href={`/admin/importaciones?page=${pagina - 1}`}
                className="boton-enlace inline-flex h-9 items-center rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-muted"
              >
                Anterior
              </Link>
            ) : null}

            {pagina < totalPaginas ? (
              <Link
                href={`/admin/importaciones?page=${pagina + 1}`}
                className="boton-enlace inline-flex h-9 items-center rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-muted"
              >
                Siguiente
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
