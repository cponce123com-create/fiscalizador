'use client';

import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Info,
  RotateCcw,
  ShieldAlert,
  Upload,
  XCircle,
} from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';

import { Boton } from '@/components/ui/button';
import {
  Tarjeta,
  TarjetaContenido,
  TarjetaDescripcion,
  TarjetaEncabezado,
  TarjetaTitulo,
} from '@/components/ui/card';
import {
  Aviso,
  Cargando,
  Insignia,
  Tabla,
  TablaCelda,
  TablaCeldaEncabezado,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from '@/components/ui/data';
import { Campo, GrupoCampo, Interruptor, Selector } from '@/components/ui/form';
import {
  analizarRespuestaSchema,
  confirmarRespuestaSchema,
  pedirJson,
  type AnalizarRespuesta,
  type ConfirmarRespuesta,
  type IssueRespuesta,
} from '@/lib/api/cliente';
import { formatearCentavos, MESES } from '@/lib/utils';
import { CAMPOS_INTERNOS, type InternalField } from '@/services/mappingService';

/**
 * Asistente de importación en cuatro pasos.
 *
 * Principio que gobierna todo el flujo: el análisis NO escribe nada. El
 * administrador ve exactamente qué se va a importar y qué problemas hay antes de
 * que se toque la base de datos. La confirmación reenvía solo el identificador
 * del lote y las correcciones de mapeo; las filas se releen en el servidor desde
 * el archivo original.
 */

type Paso = 'datos' | 'analizando' | 'revision' | 'confirmando' | 'listo';

type FilaMapeo = {
  position: number;
  field: InternalField | null;
  isPublic: boolean;
};

const TIPOS_INFORMACION = [
  { valor: 'CONSOLIDADO', etiqueta: 'Consolidado (órdenes de compra y de servicio)' },
  { valor: 'ORDENES_COMPRA', etiqueta: 'Solo órdenes de compra' },
  { valor: 'ORDENES_SERVICIO', etiqueta: 'Solo órdenes de servicio' },
];

/** Comprueba que un texto sea uno de los campos internos conocidos. */
function esCampoInterno(valor: string): valor is InternalField {
  return CAMPOS_INTERNOS.some((campo) => campo.field === valor);
}

/** Etiqueta legible de un campo interno, o el propio texto si no se reconoce. */
function etiquetaDeCampo(valor: string): string {
  return CAMPOS_INTERNOS.find((campo) => campo.field === valor)?.label ?? valor;
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

export function AsistenteImportacion() {
  const ahora = new Date();

  const [paso, setPaso] = useState<Paso>('datos');
  const [anio, setAnio] = useState(ahora.getFullYear());
  const [mes, setMes] = useState(ahora.getMonth() + 1);
  const [tipo, setTipo] = useState('CONSOLIDADO');
  const [archivo, setArchivo] = useState<File | null>(null);

  const [analisis, setAnalisis] = useState<AnalizarRespuesta | null>(null);
  const [mapeo, setMapeo] = useState<FilaMapeo[]>([]);
  const [resultado, setResultado] = useState<ConfirmarRespuesta | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [necesitaReemplazo, setNecesitaReemplazo] = useState(false);

  function reiniciar() {
    setPaso('datos');
    setArchivo(null);
    setAnalisis(null);
    setMapeo([]);
    setResultado(null);
    setError(null);
    setNecesitaReemplazo(false);
  }

  async function analizar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    if (!archivo) {
      setError('Selecciona el archivo del libro que quieres importar.');
      return;
    }

    setPaso('analizando');

    try {
      const formulario = new FormData();
      formulario.set('archivo', archivo);
      formulario.set('year', String(anio));
      formulario.set('month', String(mes));
      formulario.set('importType', tipo);

      const datos = await pedirJson('/api/admin/imports/analyze', { method: 'POST', body: formulario }, analizarRespuestaSchema);

      setAnalisis(datos);
      setMapeo(
        datos.columns.map((columna) => ({
          position: columna.position,
          // El campo llega como texto desde el JSON; solo se acepta si es conocido.
          field: columna.field !== null && esCampoInterno(columna.field) ? columna.field : null,
          isPublic: columna.isPublic,
        })),
      );
      setPaso('revision');
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo analizar el archivo.');
      setPaso('datos');
    }
  }

  async function confirmar(reemplazarPeriodo: boolean) {
    if (!analisis) return;

    setError(null);
    setNecesitaReemplazo(false);
    setPaso('confirmando');

    try {
      const datos = await pedirJson(
        '/api/admin/imports/confirm',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            importBatchId: analisis.importBatchId,
            reemplazarPeriodo,
            mapping: mapeo,
          }),
        },
        confirmarRespuestaSchema,
      );

      setResultado(datos);
      setPaso('listo');
    } catch (fallo) {
      const mensaje = fallo instanceof Error ? fallo.message : 'No se pudo confirmar la importación.';
      setError(mensaje);
      // Un periodo ya importado no se reintenta solo: se ofrece una decisión
      // explícita al administrador.
      setNecesitaReemplazo(mensaje.includes('periodo'));
      setPaso('revision');
    }
  }

  function actualizarMapeo(position: number, cambios: Partial<FilaMapeo>) {
    setMapeo((anterior) =>
      anterior.map((fila) => (fila.position === position ? { ...fila, ...cambios } : fila)),
    );
  }

  // ---------------------------------------------------------------------------
  // Paso 1: datos del lote
  // ---------------------------------------------------------------------------

  if (paso === 'datos' || paso === 'analizando') {
    return (
      <Tarjeta>
        <TarjetaEncabezado>
          <TarjetaTitulo>Datos del lote</TarjetaTitulo>
          <TarjetaDescripcion>
            Indica a qué periodo corresponde el libro. Se usará para situar las órdenes en su
            gestión.
          </TarjetaDescripcion>
        </TarjetaEncabezado>

        <TarjetaContenido>
          <form onSubmit={analizar} className="flex flex-col gap-5">
            {error ? (
              <Aviso tono="error" titulo="No se pudo continuar" icono={<XCircle className="h-4 w-4" />}>
                {error}
              </Aviso>
            ) : null}

            <div className="grid gap-5 sm:grid-cols-2">
              <GrupoCampo etiqueta="Año" htmlFor="anio" obligatorio>
                <Campo
                  id="anio"
                  type="number"
                  min={2000}
                  max={2100}
                  value={anio}
                  onChange={(evento: ChangeEvent<HTMLInputElement>) => setAnio(Number(evento.target.value))}
                  required
                />
              </GrupoCampo>

              <GrupoCampo etiqueta="Mes" htmlFor="mes" obligatorio>
                <Selector
                  id="mes"
                  value={mes}
                  onChange={(evento: ChangeEvent<HTMLSelectElement>) => setMes(Number(evento.target.value))}
                >
                  {MESES.map((m) => (
                    <option key={m.valor} value={m.valor}>
                      {m.nombre}
                    </option>
                  ))}
                </Selector>
              </GrupoCampo>
            </div>

            <GrupoCampo etiqueta="Tipo de información" htmlFor="tipo" obligatorio>
              <Selector id="tipo" value={tipo} onChange={(evento) => setTipo(evento.target.value)}>
                {TIPOS_INFORMACION.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.etiqueta}
                  </option>
                ))}
              </Selector>
            </GrupoCampo>

            <GrupoCampo
              etiqueta="Archivo del libro"
              htmlFor="archivo"
              obligatorio
              ayuda="Formatos admitidos: .xls, .xlsx y .csv. El archivo original se conserva íntegro."
            >
              <Campo
                id="archivo"
                type="file"
                accept=".xls,.xlsx,.csv"
                onChange={(evento: ChangeEvent<HTMLInputElement>) =>
                  setArchivo(evento.target.files?.[0] ?? null)
                }
                required
              />
            </GrupoCampo>

            <div className="flex items-center gap-3">
              <Boton type="submit" disabled={paso === 'analizando'}>
                <Upload className="h-4 w-4" aria-hidden="true" />
                {paso === 'analizando' ? 'Analizando…' : 'Analizar archivo'}
              </Boton>
              <p className="text-xs text-muted-foreground">
                El análisis no modifica la base de datos.
              </p>
            </div>
          </form>

          {paso === 'analizando' ? <Cargando etiqueta="Leyendo el archivo y validando las filas…" /> : null}
        </TarjetaContenido>
      </Tarjeta>
    );
  }

  // ---------------------------------------------------------------------------
  // Paso 4: resultado
  // ---------------------------------------------------------------------------

  if (paso === 'listo' && resultado) {
    return (
      <div className="flex flex-col gap-6">
        <Aviso
          tono={resultado.status === 'COMPLETED' ? 'exito' : 'advertencia'}
          titulo={
            resultado.status === 'COMPLETED'
              ? 'Importación completada'
              : 'Importación completada con advertencias'
          }
          icono={<CheckCircle2 className="h-4 w-4" />}
        >
          {resultado.status === 'COMPLETED_WITH_WARNINGS'
            ? 'Los datos se guardaron, pero hay filas con advertencias que conviene revisar en el listado de importaciones.'
            : 'Todas las filas se importaron sin advertencias.'}
        </Aviso>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ResumenCifra etiqueta="Órdenes insertadas" valor={String(resultado.ordenesInsertadas)} />
          <ResumenCifra etiqueta="Proveedores creados" valor={String(resultado.proveedoresCreados)} />
          <ResumenCifra
            etiqueta="Proveedores ya existentes"
            valor={String(resultado.proveedoresExistentes)}
          />
          <ResumenCifra etiqueta="Variantes de razón social" valor={String(resultado.variantesDetectadas)} />
        </div>

        <Tarjeta>
          <TarjetaEncabezado>
            <TarjetaTitulo>Montos resultantes</TarjetaTitulo>
          </TarjetaEncabezado>
          <TarjetaContenido className="grid gap-4 sm:grid-cols-3">
            <ResumenCifra etiqueta="Registrado" valor={formatearCentavos(resultado.summary.registeredCents)} />
            <ResumenCifra etiqueta="Anulado" valor={formatearCentavos(resultado.summary.cancelledCents)} />
            <ResumenCifra
              etiqueta="Considerado"
              valor={formatearCentavos(resultado.summary.consideredCents)}
              destacada
            />
          </TarjetaContenido>
        </Tarjeta>

        <div className="flex items-center gap-3">
          <Boton onClick={reiniciar} variant="outline">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Importar otro archivo
          </Boton>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Paso 3: revisión y confirmación
  // ---------------------------------------------------------------------------

  if (!analisis) return null;

  const { summary, issues, preview, columns, camposFaltantes, loteMismoChecksum, lotesMismoPeriodo } =
    analisis;

  const sinAsignar = mapeo.filter((fila) => fila.field === null).length;

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <Aviso tono="error" titulo="No se pudo confirmar" icono={<XCircle className="h-4 w-4" />}>
          {error}
          {necesitaReemplazo ? (
            <div className="mt-3">
              <Boton variant="destructive" onClick={() => confirmar(true)}>
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                Importar de todas formas como versión nueva
              </Boton>
            </div>
          ) : null}
        </Aviso>
      ) : null}

      {loteMismoChecksum ? (
        <Aviso
          tono="advertencia"
          titulo="Este archivo ya fue importado"
          icono={<AlertTriangle className="h-4 w-4" />}
        >
          Su contenido coincide exactamente con la importación del periodo{' '}
          {loteMismoChecksum.period} (versión {loteMismoChecksum.version},{' '}
          {loteMismoChecksum.totalRows} filas). Importarlo otra vez duplicaría las órdenes.
        </Aviso>
      ) : null}

      {lotesMismoPeriodo.length > 0 ? (
        <Aviso
          tono="advertencia"
          titulo="El periodo ya tiene importaciones"
          icono={<AlertTriangle className="h-4 w-4" />}
        >
          Hay {lotesMismoPeriodo.length} importación(es) registrada(s) para este periodo. Esta sería
          la versión {analisis.version}. Nada se reemplaza en silencio: las versiones anteriores se
          conservan y quedan auditadas.
        </Aviso>
      ) : null}

      {camposFaltantes.length > 0 ? (
        <Aviso tono="error" titulo="Faltan columnas obligatorias" icono={<XCircle className="h-4 w-4" />}>
          No se reconoció ninguna columna para: {camposFaltantes.map(etiquetaDeCampo).join(', ')}.
          Asigna esas columnas manualmente antes de continuar.
        </Aviso>
      ) : null}

      <Tarjeta>
        <TarjetaEncabezado>
          <TarjetaTitulo>Resumen del análisis</TarjetaTitulo>
          <TarjetaDescripcion>
            Hoja «{analisis.sheetName}» · {analisis.sheetNames.length} hoja(s) en el libro · versión{' '}
            {analisis.version}
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
                          actualizarMapeo(columna.position, {
                            field: valor === '' ? null : esCampoInterno(valor) ? valor : fila?.field ?? null,
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
                        onChange={(valor) => actualizarMapeo(columna.position, { isPublic: valor })}
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
                    {fila.amount !== null ? formatearCentavos(Math.round(Number(fila.amount) * 100)) : '—'}
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

      <div className="flex flex-wrap items-center gap-3">
        <Boton
          onClick={() => confirmar(false)}
          disabled={paso === 'confirmando' || summary.successfulRows === 0}
        >
          <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
          {paso === 'confirmando'
            ? 'Importando…'
            : `Confirmar e importar ${summary.successfulRows} órdenes`}
        </Boton>

        <Boton variant="outline" onClick={reiniciar} disabled={paso === 'confirmando'}>
          Cancelar
        </Boton>

        <p className="text-xs text-muted-foreground">
          Al confirmar se insertan las órdenes en una única transacción.
        </p>
      </div>
    </div>
  );
}

/** Cifra compacta para los resúmenes del asistente. */
function ResumenCifra({
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
