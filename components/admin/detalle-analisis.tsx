'use client';

import { Info, XCircle } from 'lucide-react';

import {
  Tarjeta,
  TarjetaContenido,
  TarjetaDescripcion,
  TarjetaEncabezado,
  TarjetaTitulo,
} from '@/components/ui/card';
import {
  Aviso,
  Insignia,
  Tabla,
  TablaCelda,
  TablaCeldaEncabezado,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from '@/components/ui/data';
import { Interruptor, Selector } from '@/components/ui/form';
import type { AnalizarRespuesta, IssueRespuesta } from '@/lib/api/cliente';
import { formatearCentavos } from '@/lib/utils';
import { CAMPOS_INTERNOS, type InternalField } from '@/services/mappingService';

/**
 * Detalle de un análisis: resumen, columnas detectadas, vista previa y hallazgos.
 *
 * Vive en su propio módulo porque lo comparten la importación por lotes y
 * cualquier pantalla que necesite revisar un lote. El estado del mapeo NO vive
 * aquí: lo tiene el contenedor, que es quien decide qué correcciones se envían al
 * confirmar.
 */

export type FilaMapeo = {
  position: number;
  field: InternalField | null;
  isPublic: boolean;
};

/** Comprueba que un texto sea uno de los campos internos conocidos. */
export function esCampoInterno(valor: string): valor is InternalField {
  return CAMPOS_INTERNOS.some((campo) => campo.field === valor);
}

/** Etiqueta legible de un campo interno, o el propio texto si no se reconoce. */
export function etiquetaDeCampo(valor: string): string {
  return CAMPOS_INTERNOS.find((campo) => campo.field === valor)?.label ?? valor;
}

/**
 * Estado inicial del mapeo a partir de la propuesta del servidor.
 *
 * El campo llega como texto desde el JSON; solo se acepta si es un campo conocido,
 * en lugar de confiarlo con un cast.
 */
export function mapeoDesdeAnalisis(analisis: AnalizarRespuesta): FilaMapeo[] {
  return analisis.columns.map((columna) => ({
    position: columna.position,
    field: columna.field !== null && esCampoInterno(columna.field) ? columna.field : null,
    isPublic: columna.isPublic,
  }));
}

const TONO_POR_SEVERIDAD: Record<IssueRespuesta['severity'], 'error' | 'advertencia' | 'info'> = {
  ERROR: 'error',
  WARNING: 'advertencia',
  INFO: 'info',
};

const ETIQUETA_SEVERIDAD: Record<IssueRespuesta['severity'], string> = {
  ERROR: 'Error',
  WARNING: 'Advertencia',
  INFO: 'Información',
};

/** Cifra compacta para los resúmenes. */
export function ResumenCifra({
  etiqueta,
  valor,
  destacada,
}: {
  etiqueta: string;
  valor: string;
  destacada?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {etiqueta}
      </span>
      <span
        className={
          destacada
            ? 'tabular text-xl font-semibold text-primary'
            : 'tabular text-xl font-semibold text-foreground'
        }
      >
        {valor}
      </span>
    </div>
  );
}

export function DetalleAnalisis({
  analisis,
  mapeo,
  onCambioMapeo,
}: {
  analisis: AnalizarRespuesta;
  mapeo: FilaMapeo[];
  onCambioMapeo: (position: number, cambios: Partial<FilaMapeo>) => void;
}) {
  const { summary, issues, preview, columns, camposFaltantes, sheetName, sheetNames, version } =
    analisis;

  const sinAsignar = mapeo.filter((fila) => fila.field === null).length;

  return (
    <div className="flex flex-col gap-6">
      {camposFaltantes.length > 0 ? (
        <Aviso
          tono="error"
          titulo="Faltan columnas obligatorias"
          icono={<XCircle className="h-4 w-4" />}
        >
          No se reconoció ninguna columna para: {camposFaltantes.map(etiquetaDeCampo).join(', ')}.
          Asigna esas columnas manualmente antes de continuar.
        </Aviso>
      ) : null}

      <Tarjeta>
        <TarjetaEncabezado>
          <TarjetaTitulo>Resumen del análisis</TarjetaTitulo>
          <TarjetaDescripcion>
            Hoja «{sheetName}» · {sheetNames.length} hoja(s) en el libro · versión {version}
          </TarjetaDescripcion>
        </TarjetaEncabezado>

        <TarjetaContenido className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ResumenCifra etiqueta="Filas leídas" valor={String(summary.totalRows)} />
          <ResumenCifra etiqueta="Filas válidas" valor={String(summary.successfulRows)} />
          <ResumenCifra etiqueta="Con advertencia" valor={String(summary.warningRows)} />
          <ResumenCifra etiqueta="Con error" valor={String(summary.errorRows)} />
          <ResumenCifra etiqueta="Anuladas" valor={String(summary.cancelledRows)} />
          <ResumenCifra etiqueta="Monto registrado" valor={formatearCentavos(summary.registeredCents)} />
          <ResumenCifra etiqueta="Monto anulado" valor={formatearCentavos(summary.cancelledCents)} />
          <ResumenCifra
            etiqueta="Monto considerado"
            valor={formatearCentavos(summary.consideredCents)}
            destacada
          />
        </TarjetaContenido>
      </Tarjeta>

      <Tarjeta>
        <TarjetaEncabezado>
          <TarjetaTitulo>Columnas detectadas</TarjetaTitulo>
          <TarjetaDescripcion>
            Revisa el mapeo propuesto. Si algo no encaja, corrígelo aquí antes de confirmar: la
            corrección se guarda para las próximas importaciones.
            {sinAsignar > 0 ? ` Hay ${sinAsignar} columna(s) sin asignar.` : ''}
          </TarjetaDescripcion>
        </TarjetaEncabezado>

        <TarjetaContenido className="p-0">
          <Tabla>
            <TablaEncabezado>
              <TablaFila>
                <TablaCeldaEncabezado>Columna del archivo</TablaCeldaEncabezado>
                <TablaCeldaEncabezado>Campo interno</TablaCeldaEncabezado>
                <TablaCeldaEncabezado>Detección</TablaCeldaEncabezado>
                <TablaCeldaEncabezado>Visible al público</TablaCeldaEncabezado>
                <TablaCeldaEncabezado>Ejemplos</TablaCeldaEncabezado>
              </TablaFila>
            </TablaEncabezado>

            <TablaCuerpo>
              {columns.map((columna) => {
                const fila = mapeo.find((m) => m.position === columna.position);

                return (
                  <TablaFila key={columna.position}>
                    <TablaCelda>
                      <span className="font-medium">{columna.originalName || '(sin nombre)'}</span>
                      {columna.isRequired ? (
                        <Insignia tono="info" className="ml-2">
                          obligatoria
                        </Insignia>
                      ) : null}
                    </TablaCelda>

                    <TablaCelda>
                      <Selector
                        aria-label={`Campo interno de ${columna.originalName}`}
                        value={fila?.field ?? ''}
                        onChange={(evento) => {
                          const valor = evento.target.value;
                          onCambioMapeo(columna.position, {
                            field:
                              valor === ''
                                ? null
                                : esCampoInterno(valor)
                                  ? valor
                                  : (fila?.field ?? null),
                          });
                        }}
                      >
                        <option value="">Sin asignar</option>
                        {CAMPOS_INTERNOS.map((campo) => (
                          <option key={campo.field} value={campo.field}>
                            {campo.label}
                          </option>
                        ))}
                      </Selector>
                    </TablaCelda>

                    <TablaCelda>
                      {columna.matchedBy === null ? (
                        <Insignia tono="neutro">sin coincidencia</Insignia>
                      ) : columna.matchedBy === 'EXACTO' ? (
                        <Insignia tono="exito">exacta</Insignia>
                      ) : (
                        <Insignia tono="advertencia">
                          {columna.matchedBy === 'ALIAS' ? 'por alias' : 'por similitud'}{' '}
                          {Math.round(columna.confidence * 100)}%
                        </Insignia>
                      )}
                    </TablaCelda>

                    <TablaCelda>
                      <Interruptor
                        id={`publico-${columna.position}`}
                        etiqueta=""
                        nombreAccesible={`Mostrar públicamente la columna ${columna.originalName}`}
                        checked={fila?.isPublic ?? false}
                        onChange={(valor) => onCambioMapeo(columna.position, { isPublic: valor })}
                      />
                    </TablaCelda>

                    <TablaCelda className="text-xs text-muted-foreground">
                      {columna.sampleValues.length > 0
                        ? columna.sampleValues.join(' · ').slice(0, 90)
                        : '—'}
                    </TablaCelda>
                  </TablaFila>
                );
              })}
            </TablaCuerpo>
          </Tabla>
        </TarjetaContenido>
      </Tarjeta>

      <Tarjeta>
        <TarjetaEncabezado>
          <TarjetaTitulo>Vista previa</TarjetaTitulo>
          <TarjetaDescripcion>
            Primeras {preview.length} filas de las {summary.successfulRows} que se importarían.
          </TarjetaDescripcion>
        </TarjetaEncabezado>

        <TarjetaContenido className="p-0">
          <Tabla>
            <TablaEncabezado>
              <TablaFila>
                <TablaCeldaEncabezado>Fila</TablaCeldaEncabezado>
                <TablaCeldaEncabezado>Nº orden</TablaCeldaEncabezado>
                <TablaCeldaEncabezado>RUC</TablaCeldaEncabezado>
                <TablaCeldaEncabezado>Proveedor</TablaCeldaEncabezado>
                <TablaCeldaEncabezado>Emisión</TablaCeldaEncabezado>
                <TablaCeldaEncabezado>Estado</TablaCeldaEncabezado>
                <TablaCeldaEncabezado className="text-right">Monto</TablaCeldaEncabezado>
              </TablaFila>
            </TablaEncabezado>

            <TablaCuerpo>
              {preview.map((fila) => (
                <TablaFila key={fila.sourceRow}>
                  <TablaCelda className="text-muted-foreground">{fila.sourceRow}</TablaCelda>
                  <TablaCelda className="font-medium">{fila.orderNumber}</TablaCelda>
                  <TablaCelda className="tabular">{fila.ruc ?? '—'}</TablaCelda>
                  <TablaCelda className="max-w-xs truncate" title={fila.supplierName ?? ''}>
                    {fila.supplierName ?? '—'}
                  </TablaCelda>
                  <TablaCelda className="tabular">{fila.issueDate ?? '—'}</TablaCelda>
                  <TablaCelda>
                    {fila.isCancelled ? (
                      <Insignia tono="error">{fila.statusRaw ?? 'Anulada'}</Insignia>
                    ) : (
                      <Insignia tono="exito">{fila.statusRaw ?? '—'}</Insignia>
                    )}
                  </TablaCelda>
                  <TablaCelda className="tabular text-right">
                    {fila.amount !== null
                      ? formatearCentavos(Math.round(Number(fila.amount) * 100))
                      : '—'}
                  </TablaCelda>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        </TarjetaContenido>
      </Tarjeta>

      {issues.length > 0 ? (
        <Tarjeta>
          <TarjetaEncabezado>
            <TarjetaTitulo>Hallazgos del análisis</TarjetaTitulo>
            <TarjetaDescripcion>
              {issues.length} hallazgo(s). Un error impide importar esa fila; una advertencia no
              bloquea nada y la decide el administrador.
            </TarjetaDescripcion>
          </TarjetaEncabezado>

          <TarjetaContenido className="p-0">
            <Tabla>
              <TablaEncabezado>
                <TablaFila>
                  <TablaCeldaEncabezado>Fila</TablaCeldaEncabezado>
                  <TablaCeldaEncabezado>Gravedad</TablaCeldaEncabezado>
                  <TablaCeldaEncabezado>Detalle</TablaCeldaEncabezado>
                  <TablaCeldaEncabezado>Valor</TablaCeldaEncabezado>
                </TablaFila>
              </TablaEncabezado>

              <TablaCuerpo>
                {issues.slice(0, 100).map((issue, indice) => (
                  <TablaFila key={`${issue.sourceRow}-${issue.code}-${indice}`}>
                    <TablaCelda className="tabular">{issue.sourceRow}</TablaCelda>
                    <TablaCelda>
                      <Insignia tono={TONO_POR_SEVERIDAD[issue.severity]}>
                        {ETIQUETA_SEVERIDAD[issue.severity]}
                      </Insignia>
                    </TablaCelda>
                    <TablaCelda>
                      {issue.message}
                      {issue.columnName ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({issue.columnName})
                        </span>
                      ) : null}
                    </TablaCelda>
                    <TablaCelda className="text-xs text-muted-foreground">
                      {issue.rawValue ?? '—'}
                    </TablaCelda>
                  </TablaFila>
                ))}
              </TablaCuerpo>
            </Tabla>

            {issues.length > 100 ? (
              <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
                Se muestran los primeros 100 hallazgos de {issues.length}. El resto queda registrado
                en el lote.
              </p>
            ) : null}
          </TarjetaContenido>
        </Tarjeta>
      ) : (
        <Aviso tono="exito" titulo="Sin hallazgos" icono={<Info className="h-4 w-4" />}>
          No se detectó ningún problema en las filas del archivo.
        </Aviso>
      )}
    </div>
  );
}
