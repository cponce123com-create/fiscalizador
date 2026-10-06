'use client';

import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Info,
  RotateCcw,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useState, type ChangeEvent } from 'react';

import {
  DetalleAnalisis,
  ResumenCifra,
  mapeoDesdeAnalisis,
  resumirHallazgos,
  tieneAlgoQueRevisar,
  type FilaMapeo,
} from '@/components/admin/detalle-analisis';
import { ZonaDeCarga } from '@/components/admin/zona-de-carga';
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
import { GrupoCampo, Interruptor, Selector } from '@/components/ui/form';
import {
  analizarRespuestaSchema,
  confirmarRespuestaSchema,
  pedirJson,
  periodoRespuestaSchema,
  type AnalizarRespuesta,
  type ConfirmarRespuesta,
  type PeriodoRespuesta,
} from '@/lib/api/cliente';
import { formatearCentavos, MESES } from '@/lib/utils';

/**
 * Importación por lotes.
 *
 * Permite soltar varios libros y procesarlos en cola. El periodo de cada uno se
 * deduce de sus fechas de emisión, así que importar un año entero no obliga a
 * elegir doce meses a mano.
 *
 * La tanda la orquesta el NAVEGADOR: cada libro es una petición corta a `/analyze`
 * y otra a `/confirm`. Eso hace que el progreso sea real sin streaming y, sobre
 * todo, que un libro defectuoso no detenga a los demás: cada uno se analiza y se
 * confirma por su cuenta, y lo que falla se queda marcado en su fila.
 */

const MAX_ARCHIVOS = 20;
const TAMANO_MAXIMO_BYTES = 25 * 1024 * 1024;
const EXTENSIONES = ['.xls', '.xlsx', '.csv'];
/** Cuántas lecturas de periodo se piden a la vez al soltar los archivos. */
const CONCURRENCIA_PERIODO = 3;

const TIPOS_INFORMACION = [
  { valor: 'CONSOLIDADO', etiqueta: 'Consolidado (órdenes de compra y de servicio)' },
  { valor: 'ORDENES_COMPRA', etiqueta: 'Solo órdenes de compra' },
  { valor: 'ORDENES_SERVICIO', etiqueta: 'Solo órdenes de servicio' },
];

type EstadoArchivo =
  | 'detectando'
  | 'listo'
  | 'analizando'
  | 'error'
  | 'analizado'
  | 'importando'
  | 'importado';

type ArchivoEnCola = {
  id: string;
  file: File;
  estado: EstadoArchivo;
  error: string | null;
  /** Motivo por el que llega excluido de la importación (duplicado, sin columnas…). */
  motivoExclusion: string | null;
  /** Nombre de otro archivo de la tanda con el mismo nombre y tamaño. */
  duplicadoDe: string | null;
  periodo: string;
  deteccion: PeriodoRespuesta | null;
  analisis: AnalizarRespuesta | null;
  mapeo: FilaMapeo[];
  /**
   * Filas del libro que el administrador dejó fuera después de revisar los hallazgos.
   * Es distinto de `incluido`, que decide sobre el libro entero.
   */
  excluidas: number[];
  incluido: boolean;
  reemplazar: boolean;
  sourceUrl: string;
  coverageComplete: boolean;
  resultado: ConfirmarRespuesta | null;
  detalleAbierto: boolean;
};

function extensionDe(nombre: string): string {
  const punto = nombre.lastIndexOf('.');
  return punto === -1 ? '' : nombre.slice(punto).toLowerCase();
}

function periodoDeAnioMes(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}`;
}

function anioDePeriodo(periodo: string): number {
  return Number.parseInt(periodo.slice(0, 4), 10);
}

function mesDePeriodo(periodo: string): number {
  return Number.parseInt(periodo.slice(5, 7), 10);
}

/** Ejecuta tareas asíncronas con un límite de concurrencia. */
async function enParalelo(tareas: (() => Promise<void>)[], limite: number): Promise<void> {
  let siguiente = 0;

  async function trabajador(): Promise<void> {
    while (siguiente < tareas.length) {
      const indice = siguiente++;
      const tarea = tareas[indice];
      if (tarea) await tarea();
    }
  }

  const trabajadores = Array.from({ length: Math.min(limite, tareas.length) }, trabajador);
  await Promise.all(trabajadores);
}

export function ImportacionPorLotes() {
  const ahora = new Date();

  const [archivos, setArchivos] = useState<ArchivoEnCola[]>([]);
  const [tipo, setTipo] = useState('CONSOLIDADO');
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [analizando, setAnalizando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [progreso, setProgreso] = useState<{ hechos: number; total: number } | null>(null);
  const [soloConHallazgos, setSoloConHallazgos] = useState(false);

  const anios = Array.from({ length: ahora.getFullYear() - 2009 }, (_, i) => 2010 + i);
  const periodoPorDefecto = periodoDeAnioMes(ahora.getFullYear(), ahora.getMonth() + 1);

  const ocupado = analizando || confirmando;

  const enCola = archivos.filter((archivo) => archivo.analisis === null);
  const enRevision = archivos.filter((archivo) => archivo.analisis !== null);

  const listosParaAnalizar = enCola.filter(
    (archivo) => archivo.estado === 'listo' && archivo.periodo !== '',
  );

  const incluidos = enRevision.filter(
    (archivo) => archivo.incluido && archivo.estado === 'analizado',
  );
  const importados = enRevision.filter((archivo) => archivo.estado === 'importado');

  // Los libros que traen algo que mirar, para poder ir directo a ellos.
  const conHallazgos = enRevision.filter((archivo) => {
    const analisis = archivo.analisis;
    return analisis !== null && tieneAlgoQueRevisar(resumirHallazgos(analisis));
  });

  const librosVisibles = soloConHallazgos ? conHallazgos : enRevision;

  const totales = incluidos.reduce(
    (acumulado, archivo) => {
      const resumen = archivo.analisis?.summary;
      if (!resumen) return acumulado;
      return {
        filas: acumulado.filas + resumen.totalRows,
        validas: acumulado.validas + resumen.successfulRows,
        avisos: acumulado.avisos + resumen.warningRows,
        errores: acumulado.errores + resumen.errorRows,
        considerado: acumulado.considerado + resumen.consideredCents,
      };
    },
    { filas: 0, validas: 0, avisos: 0, errores: 0, considerado: 0 },
  );

  function actualizar(id: string, cambios: Partial<ArchivoEnCola>) {
    setArchivos((anterior) =>
      anterior.map((archivo) => (archivo.id === id ? { ...archivo, ...cambios } : archivo)),
    );
  }

  function agregarArchivos(nuevos: File[]) {
    setErrorGlobal(null);

    const aceptados: ArchivoEnCola[] = [];
    const rechazados: string[] = [];
    const conocidos = archivos.map((archivo) => archivo.file);

    for (const file of nuevos) {
      if (archivos.length + aceptados.length >= MAX_ARCHIVOS) {
        rechazados.push(`${file.name}: se alcanzó el límite de ${MAX_ARCHIVOS} archivos.`);
        continue;
      }

      if (!EXTENSIONES.includes(extensionDe(file.name))) {
        rechazados.push(`${file.name}: formato no admitido. Solo .xls, .xlsx y .csv.`);
        continue;
      }
      if (file.size === 0) {
        rechazados.push(`${file.name}: el archivo está vacío.`);
        continue;
      }
      if (file.size > TAMANO_MAXIMO_BYTES) {
        rechazados.push(`${file.name}: supera el límite de 25 MB.`);
        continue;
      }

      const duplicado = [...conocidos, ...aceptados.map((archivo) => archivo.file)].find(
        (otro) => otro.name === file.name && otro.size === file.size,
      );

      aceptados.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${aceptados.length}`,
        file,
        estado: 'detectando',
        error: null,
        motivoExclusion: null,
        duplicadoDe: duplicado?.name ?? null,
        periodo: periodoPorDefecto,
        deteccion: null,
        analisis: null,
        mapeo: [],
        excluidas: [],
        incluido: true,
        reemplazar: false,
        sourceUrl: "",
        coverageComplete: false,
        resultado: null,
        detalleAbierto: false,
      });
    }

    if (rechazados.length > 0) setErrorGlobal(rechazados.join(' '));
    if (aceptados.length === 0) return;

    setArchivos((anterior) => [...anterior, ...aceptados]);
    void detectarPeriodos(aceptados);
  }

  async function detectarPeriodos(nuevos: ArchivoEnCola[]) {
    const tareas = nuevos.map((archivo) => async () => {
      try {
        const formulario = new FormData();
        formulario.set('archivo', archivo.file);

        const datos = await pedirJson(
          '/api/admin/imports/periodo',
          { method: 'POST', body: formulario },
          periodoRespuestaSchema,
        );

        actualizar(archivo.id, {
          estado: 'listo',
          deteccion: datos,
          periodo: datos.periodoSugerido ?? datos.periodoDelNombre ?? archivo.periodo,
          error: null,
        });
      } catch (fallo) {
        actualizar(archivo.id, {
          estado: 'error',
          error: fallo instanceof Error ? fallo.message : 'No se pudo leer el archivo.',
        });
      }
    });

    await enParalelo(tareas, CONCURRENCIA_PERIODO);
  }

  async function analizarTanda() {
    if (listosParaAnalizar.length === 0) {
      setErrorGlobal('No hay libros listos para analizar.');
      return;
    }

    setErrorGlobal(null);
    setAnalizando(true);
    setProgreso({ hechos: 0, total: listosParaAnalizar.length });

    let hechos = 0;

    for (const archivo of listosParaAnalizar) {
      actualizar(archivo.id, { estado: 'analizando' });

      try {
        const formulario = new FormData();
        formulario.set('archivo', archivo.file);
        formulario.set('year', String(anioDePeriodo(archivo.periodo)));
        formulario.set('month', String(mesDePeriodo(archivo.periodo)));
        formulario.set('importType', tipo);

        const datos = await pedirJson(
          '/api/admin/imports/analyze',
          { method: 'POST', body: formulario },
          analizarRespuestaSchema,
        );

        // Se excluye por defecto lo que no se puede importar con sentido: el mismo
        // archivo ya importado, un libro cuyas filas ya están todas en el portal, uno
        // sin columnas obligatorias o sin ninguna fila válida. El administrador puede
        // volver a incluirlo si quiere.
        const mismoArchivo = datos.loteMismoChecksum !== null;
        const yaImportado =
          datos.duplicadoContenido.filasRepetidas > 0 && datos.duplicadoContenido.filasNuevas === 0;
        const sinColumnas = datos.camposFaltantes.length > 0;
        const sinFilas = datos.summary.successfulRows === 0;

        actualizar(archivo.id, {
          estado: 'analizado',
          analisis: datos,
          mapeo: mapeoDesdeAnalisis(datos),
          // Un análisis nuevo parte sin decisiones tomadas.
          excluidas: [],
          incluido: !(mismoArchivo || yaImportado || sinColumnas || sinFilas),
          motivoExclusion: mismoArchivo
            ? 'Ya se importó un archivo con este mismo contenido.'
            : yaImportado
              ? `Ya importado: sus ${datos.duplicadoContenido.filasRepetidas} filas están en el portal.`
              : sinColumnas
                ? 'Faltan columnas obligatorias.'
                : sinFilas
                  ? 'No hay ninguna fila válida.'
                  : null,
          error: null,
        });
      } catch (fallo) {
        actualizar(archivo.id, {
          estado: 'error',
          error: fallo instanceof Error ? fallo.message : 'No se pudo analizar el archivo.',
        });
      }

      hechos++;
      setProgreso({ hechos, total: listosParaAnalizar.length });
    }

    setAnalizando(false);
  }

  async function confirmarTanda() {
    if (incluidos.length === 0) {
      setErrorGlobal('No hay libros incluidos para importar.');
      return;
    }

    setErrorGlobal(null);
    setConfirmando(true);
    setProgreso({ hechos: 0, total: incluidos.length });

    let hechos = 0;

    for (const archivo of incluidos) {
      actualizar(archivo.id, { estado: 'importando' });

      try {
        const datos = await pedirJson(
          '/api/admin/imports/confirm',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              importBatchId: archivo.analisis?.importBatchId,
              reemplazarPeriodo: archivo.reemplazar,
              sourceUrl: archivo.sourceUrl,
              coverageComplete: archivo.coverageComplete,
              // Las filas que ya están en el portal no se vuelven a insertar: así
              // reimportar un libro corregido no duplica lo que no ha cambiado.
              omitirDuplicados: true,
              // Las filas que el administrador dejó fuera al revisar los hallazgos.
              filasExcluidas: archivo.excluidas,
              mapping: archivo.mapeo,
            }),
          },
          confirmarRespuestaSchema,
        );

        actualizar(archivo.id, { estado: 'importado', resultado: datos, error: null });
      } catch (fallo) {
        // El fallo se queda en SU fila: la cola sigue con los demás libros.
        actualizar(archivo.id, {
          estado: 'analizado',
          error: fallo instanceof Error ? fallo.message : 'No se pudo importar el libro.',
        });
      }

      hechos++;
      setProgreso({ hechos, total: incluidos.length });
    }

    setConfirmando(false);
  }

  function quitar(id: string) {
    setArchivos((anterior) => anterior.filter((archivo) => archivo.id !== id));
  }

  function reiniciar() {
    setArchivos([]);
    setErrorGlobal(null);
    setProgreso(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {errorGlobal ? (
        <Aviso tono="error" titulo="No se pudo continuar" icono={<XCircle className="h-4 w-4" />}>
          {errorGlobal}
        </Aviso>
      ) : null}

      <Tarjeta>
        <TarjetaEncabezado>
          <TarjetaTitulo>Elige los libros</TarjetaTitulo>
          <TarjetaDescripcion>
            Suelta todos los libros de una vez. El mes y el año de cada uno se deducen de sus fechas
            de emisión; revísalos antes de analizar.
          </TarjetaDescripcion>
        </TarjetaEncabezado>

        <TarjetaContenido className="flex flex-col gap-5">
          <ZonaDeCarga
            onArchivos={agregarArchivos}
            deshabilitada={ocupado || archivos.length >= MAX_ARCHIVOS}
            maxArchivos={MAX_ARCHIVOS}
          />

          <GrupoCampo
            etiqueta="Tipo de información"
            htmlFor="tipo"
            obligatorio
            ayuda="Se aplica a todos los libros de la tanda."
          >
            <Selector
              id="tipo"
              value={tipo}
              onChange={(evento: ChangeEvent<HTMLSelectElement>) => setTipo(evento.target.value)}
              disabled={ocupado}
            >
              {TIPOS_INFORMACION.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </Selector>
          </GrupoCampo>
        </TarjetaContenido>
      </Tarjeta>

      {enCola.length > 0 ? (
        <Tarjeta>
          <TarjetaEncabezado>
            <TarjetaTitulo>Libros en cola ({enCola.length})</TarjetaTitulo>
            <TarjetaDescripcion>
              Comprueba el periodo de cada libro. Si la deducción falla, aparece el mes actual y hay
              que corregirlo.
            </TarjetaDescripcion>
          </TarjetaEncabezado>

          <TarjetaContenido className="p-0">
            <Tabla>
              <TablaEncabezado>
                <TablaFila>
                  <TablaCeldaEncabezado>Archivo</TablaCeldaEncabezado>
                  <TablaCeldaEncabezado>Año</TablaCeldaEncabezado>
                  <TablaCeldaEncabezado>Mes</TablaCeldaEncabezado>
                  <TablaCeldaEncabezado>Estado</TablaCeldaEncabezado>
                  <TablaCeldaEncabezado className="text-right">Quitar</TablaCeldaEncabezado>
                </TablaFila>
              </TablaEncabezado>

              <TablaCuerpo>
                {enCola.map((archivo) => {
                  const anio = anioDePeriodo(archivo.periodo);
                  const mes = mesDePeriodo(archivo.periodo);
                  const detectado = archivo.deteccion;

                  return (
                    <TablaFila key={archivo.id}>
                      <TablaCelda className="max-w-[20rem]">
                        <span className="block truncate font-medium" title={archivo.file.name}>
                          {archivo.file.name}
                        </span>
                        {archivo.duplicadoDe ? (
                          <span className="mt-1 flex items-center gap-1 text-xs text-warning">
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                            Posible duplicado de «{archivo.duplicadoDe}» en esta misma tanda.
                          </span>
                        ) : null}
                        {detectado && detectado.mesesDetectados.length > 1 ? (
                          <span className="mt-1 block text-xs text-warning">
                            El libro mezcla {detectado.mesesDetectados.length} meses (
                            {detectado.mesesDetectados.map((m) => m.periodo).join(', ')}). Se
                            propone el de más filas.
                          </span>
                        ) : null}
                        {detectado && detectado.coincideConElNombre === false ? (
                          <span className="mt-1 block text-xs text-warning">
                            El nombre dice {detectado.periodoDelNombre} y el contenido dice{' '}
                            {detectado.periodoSugerido}.
                          </span>
                        ) : null}
                      </TablaCelda>

                      <TablaCelda>
                        <Selector
                          aria-label={`Año de ${archivo.file.name}`}
                          value={String(anio)}
                          disabled={ocupado}
                          onChange={(evento) =>
                            actualizar(archivo.id, {
                              periodo: periodoDeAnioMes(Number(evento.target.value), mes),
                            })
                          }
                        >
                          {anios.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </Selector>
                      </TablaCelda>

                      <TablaCelda>
                        <Selector
                          aria-label={`Mes de ${archivo.file.name}`}
                          value={String(mes)}
                          disabled={ocupado}
                          onChange={(evento) =>
                            actualizar(archivo.id, {
                              periodo: periodoDeAnioMes(anio, Number(evento.target.value)),
                            })
                          }
                        >
                          {MESES.map((m) => (
                            <option key={m.valor} value={m.valor}>
                              {m.nombre}
                            </option>
                          ))}
                        </Selector>
                      </TablaCelda>

                      <TablaCelda>
                        {archivo.estado === 'detectando' ? (
                          <Insignia tono="neutro">deduciendo periodo…</Insignia>
                        ) : archivo.estado === 'analizando' ? (
                          <Insignia tono="info">analizando…</Insignia>
                        ) : archivo.estado === 'error' ? (
                          <>
                            <Insignia tono="error">error</Insignia>
                            <span className="mt-1 block max-w-[22rem] text-xs text-destructive">
                              {archivo.error}
                            </span>
                          </>
                        ) : (
                          <Insignia tono="exito">listo para analizar</Insignia>
                        )}
                      </TablaCelda>

                      <TablaCelda className="text-right">
                        <button
                          type="button"
                          onClick={() => quitar(archivo.id)}
                          disabled={ocupado}
                          aria-label={`Quitar ${archivo.file.name} de la cola`}
                          className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </TablaCelda>
                    </TablaFila>
                  );
                })}
              </TablaCuerpo>
            </Tabla>
          </TarjetaContenido>
        </Tarjeta>
      ) : null}

      {enCola.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <Boton onClick={analizarTanda} disabled={ocupado || listosParaAnalizar.length === 0}>
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            {analizando
              ? 'Analizando…'
              : `Analizar ${listosParaAnalizar.length} ${listosParaAnalizar.length === 1 ? 'libro' : 'libros'}`}
          </Boton>

          <Boton variant="outline" onClick={reiniciar} disabled={ocupado}>
            Vaciar la cola
          </Boton>

          <p className="text-xs text-muted-foreground">
            El análisis no modifica la base de datos.
          </p>
        </div>
      ) : null}

      {analizando ? (
        <Cargando etiqueta={`Analizando los libros (${progreso?.hechos ?? 0} de ${progreso?.total ?? 0})…`} />
      ) : null}

      {enRevision.length > 0 ? (
        <>
          <Tarjeta>
            <TarjetaEncabezado>
              <TarjetaTitulo>Revisión de la tanda ({enRevision.length})</TarjetaTitulo>
              <TarjetaDescripcion>
                Una fila por libro. Despliega cada una para ver el mapeo, la vista previa y los
                hallazgos, y corregir el mapeo antes de importar.
              </TarjetaDescripcion>
            </TarjetaEncabezado>

            <TarjetaContenido className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <ResumenCifra etiqueta="Filas incluidas" valor={String(totales.filas)} />
              <ResumenCifra etiqueta="Filas válidas" valor={String(totales.validas)} />
              <ResumenCifra etiqueta="Con advertencia" valor={String(totales.avisos)} />
              <ResumenCifra etiqueta="Con error" valor={String(totales.errores)} />
              <ResumenCifra
                etiqueta="Monto considerado"
                valor={formatearCentavos(totales.considerado)}
                destacada
              />
            </TarjetaContenido>
          </Tarjeta>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {conHallazgos.length === 0
                ? 'Ningún libro trae algo que revisar: se pueden importar todos tal cual.'
                : `${conHallazgos.length} de ${enRevision.length} libro(s) traen algo que revisar.`}
            </p>

            {conHallazgos.length > 0 && conHallazgos.length < enRevision.length ? (
              <Interruptor
                id="solo-con-hallazgos"
                etiqueta={`Ver solo esos (${conHallazgos.length})`}
                checked={soloConHallazgos}
                onChange={setSoloConHallazgos}
              />
            ) : null}
          </div>

          <div className="flex flex-col gap-4">
            {librosVisibles.map((archivo) => {
              const analisis = archivo.analisis;
              if (!analisis) return null;


              const resumen = resumirHallazgos(analisis);

              return (
                <Tarjeta key={archivo.id}>
                  <TarjetaEncabezado>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <TarjetaTitulo>{archivo.file.name}</TarjetaTitulo>
                        <TarjetaDescripcion>
                          Periodo {archivo.periodo} · {analisis.summary.successfulRows} filas válidas
                          de {analisis.summary.totalRows} · considerado{' '}
                          {formatearCentavos(analisis.summary.consideredCents)}
                        </TarjetaDescripcion>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {!tieneAlgoQueRevisar(resumen) ? (
                            <Insignia tono="exito">sin hallazgos</Insignia>
                          ) : null}

                          {resumen.yaImportado ? (
                            <Insignia tono="advertencia">ya importado</Insignia>
                          ) : null}

                          {resumen.yaEnElPortal > 0 ? (
                            <Insignia tono="info">
                              {resumen.yaEnElPortal} fila(s) ya en el portal
                            </Insignia>
                          ) : null}

                          {resumen.repetidas > 0 ? (
                            <Insignia tono="advertencia">
                              {resumen.repetidas} repetida(s) en el libro
                            </Insignia>
                          ) : null}

                          {resumen.sinGestion > 0 ? (
                            <Insignia tono="info">{resumen.sinGestion} sin gestión</Insignia>
                          ) : null}

                          {resumen.conAviso > 0 ? (
                            <Insignia tono="advertencia">{resumen.conAviso} con aviso</Insignia>
                          ) : null}

                          {resumen.conError > 0 ? (
                            <Insignia tono="error">{resumen.conError} con error</Insignia>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {archivo.estado === 'importado' ? (
                          <Insignia tono="exito">importado</Insignia>
                        ) : archivo.estado === 'importando' ? (
                          <Insignia tono="info">importando…</Insignia>
                        ) : archivo.incluido ? (
                          <Insignia tono="info">incluido</Insignia>
                        ) : (
                          <Insignia tono="neutro">excluido</Insignia>
                        )}

                        <Boton
                          variant="outline"
                          onClick={() =>
                            actualizar(archivo.id, { detalleAbierto: !archivo.detalleAbierto })
                          }
                        >
                          {archivo.detalleAbierto ? 'Ocultar detalle' : 'Ver detalle'}
                        </Boton>

                        <button
                          type="button"
                          onClick={() => quitar(archivo.id)}
                          disabled={ocupado || archivo.estado === 'importado'}
                          aria-label={`Quitar ${archivo.file.name} de la tanda`}
                          className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </TarjetaEncabezado>

                  <TarjetaContenido className="flex flex-col gap-4">
                    {archivo.estado !== 'importado' ? <div className="flex flex-col gap-2">
                      <label htmlFor={`fuente-${archivo.id}`}>URL pública del archivo de origen</label>
                      <input id={`fuente-${archivo.id}`} type="url" value={archivo.sourceUrl} onChange={e => actualizar(archivo.id, { sourceUrl: e.target.value })} className="rounded border p-2" placeholder="https://…" />
                      <Interruptor id={`completo-${archivo.id}`} etiqueta="He revisado que este libro contiene el periodo completo" checked={archivo.coverageComplete} onChange={valor => actualizar(archivo.id, { coverageComplete: valor })} />
                      <p className="text-xs text-muted-foreground">La sustitución conserva el historial y reemplaza todas las filas del libro anterior. Carga el libro completo, incluidos los registros que no cambiaron. Las filas excluidas quedan declaradas en la cobertura.</p>
                    </div> : null}
                    {archivo.estado !== 'importado' ? (
                      <div className="flex flex-wrap items-center gap-6">
                        <Interruptor
                          id={`incluir-${archivo.id}`}
                          etiqueta="Importar este libro"
                          checked={archivo.incluido}
                          onChange={(valor) => actualizar(archivo.id, { incluido: valor })}
                        />

                        {(
                          <Interruptor
                            id={`reemplazar-${archivo.id}`}
                            etiqueta="Reemplazar el libro vigente con esta instantánea completa"
                            checked={archivo.reemplazar}
                            onChange={(valor) => actualizar(archivo.id, { reemplazar: valor })}
                          />
                        )}
                      </div>
                    ) : null}

                    {archivo.motivoExclusion ? (
                      <p className="text-xs text-warning">
                        Excluido por defecto: {archivo.motivoExclusion}
                      </p>
                    ) : null}

                    {analisis.loteMismoChecksum ? (
                      <Aviso
                        tono="advertencia"
                        titulo="Este archivo ya fue importado"
                        icono={<AlertTriangle className="h-4 w-4" />}
                      >
                        Su contenido coincide exactamente con la importación del periodo{' '}
                        {analisis.loteMismoChecksum.period} (versión{' '}
                        {analisis.loteMismoChecksum.version}). Una nueva versión conservará el historial y sustituirá el libro vigente; no se sumarán ambas versiones.
                      </Aviso>
                    ) : null}

                    {analisis.duplicadoContenido.filasRepetidas > 0 && !analisis.loteMismoChecksum ? (
                      <Aviso
                        tono="advertencia"
                        titulo={
                          analisis.duplicadoContenido.filasNuevas === 0
                            ? 'Este libro ya está en el portal'
                            : 'Parte de este libro ya está en el portal'
                        }
                        icono={<Info className="h-4 w-4" />}
                      >
                        {analisis.duplicadoContenido.filasNuevas === 0 ? (
                          <>
                            Sus {analisis.duplicadoContenido.filasRepetidas} filas coinciden con
                            órdenes ya importadas (mismo tipo, número de orden, RUC, monto y fecha).
                            La coincidencia no comprueba el estado de las órdenes. La sustitución usa todas las filas del nuevo libro
                          </>
                        ) : (
                          <>
                            {analisis.duplicadoContenido.filasRepetidas} de{' '}
                            {analisis.duplicadoContenido.filasRepetidas +
                              analisis.duplicadoContenido.filasNuevas}{' '}
                            filas coinciden con órdenes ya importadas. La nueva instantánea incluirá todas las filas revisadas
                          </>
                        )}
                        {analisis.duplicadoContenido.lotes[0]
                          ? `; las repetidas vienen de la importación del periodo ${analisis.duplicadoContenido.lotes[0].period} (versión ${analisis.duplicadoContenido.lotes[0].version})`
                          : ''}
                        . Las filas repetidas se descartan al importar.
                      </Aviso>
                    ) : null}

                    {analisis.lotesMismoPeriodo.length > 0 ? (
                      <Aviso
                        tono="advertencia"
                        titulo="El periodo ya tiene importaciones"
                        icono={<AlertTriangle className="h-4 w-4" />}
                      >
                        Hay {analisis.lotesMismoPeriodo.length} importación(es) registrada(s) para
                        este periodo. Esta sería la versión {analisis.version}. Nada se reemplaza en
                        silencio: marca «versión nueva» si quieres continuar.
                      </Aviso>
                    ) : null}

                    {archivo.error ? (
                      <Aviso
                        tono="error"
                        titulo="No se pudo importar este libro"
                        icono={<ShieldAlert className="h-4 w-4" />}
                      >
                        {archivo.error}
                      </Aviso>
                    ) : null}

                    {archivo.resultado ? (
                      <Aviso
                        tono={
                          archivo.resultado.status === 'COMPLETED' ? 'exito' : 'advertencia'
                        }
                        titulo={
                          archivo.resultado.status === 'COMPLETED'
                            ? 'Importado sin advertencias'
                            : 'Importado con advertencias'
                        }
                        icono={<CheckCircle2 className="h-4 w-4" />}
                      >
                        {archivo.resultado.ordenesInsertadas} órdenes insertadas
                        {archivo.resultado.ordenesOmitidasPorDuplicado > 0
                          ? ` · ${archivo.resultado.ordenesOmitidasPorDuplicado} omitidas por estar ya en el portal`
                          : null}
                        {archivo.resultado.ordenesExcluidasPorDecision > 0
                          ? ` · ${archivo.resultado.ordenesExcluidasPorDecision} dejadas fuera por ti`
                          : null}{' '}
                        · {archivo.resultado.proveedoresCreados} proveedores nuevos ·{' '}
                        {archivo.resultado.proveedoresExistentes} ya existentes ·{' '}
                        {archivo.resultado.variantesDetectadas} variantes de razón social.
                      </Aviso>
                    ) : null}

                    {archivo.detalleAbierto ? (
                      <DetalleAnalisis
                        analisis={analisis}
                        mapeo={archivo.mapeo}
                        excluidas={new Set(archivo.excluidas)}
                        onAlternarExclusion={(sourceRow) =>
                          actualizar(archivo.id, {
                            excluidas: archivo.excluidas.includes(sourceRow)
                              ? archivo.excluidas.filter((fila) => fila !== sourceRow)
                              : [...archivo.excluidas, sourceRow],
                          })
                        }
                        onCambioMapeo={(position, cambios) =>
                          actualizar(archivo.id, {
                            mapeo: archivo.mapeo.map((fila) =>
                              fila.position === position ? { ...fila, ...cambios } : fila,
                            ),
                          })
                        }
                      />
                    ) : null}
                  </TarjetaContenido>
                </Tarjeta>
              );
            })}
          </div>
        </>
      ) : null}

      {enRevision.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <Boton
            onClick={confirmarTanda}
            disabled={ocupado || incluidos.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            {confirmando
              ? 'Importando…'
              : `Confirmar e importar ${incluidos.length} ${incluidos.length === 1 ? 'libro' : 'libros'}`}
          </Boton>

          <Boton variant="outline" onClick={reiniciar} disabled={ocupado}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Empezar de nuevo
          </Boton>

          <p className="text-xs text-muted-foreground">
            Cada libro se importa en su propia transacción; si uno falla, los demás continúan.
          </p>
        </div>
      ) : null}

      {confirmando ? (
        <Cargando
          etiqueta={`Importando los libros (${progreso?.hechos ?? 0} de ${progreso?.total ?? 0})…`}
        />
      ) : null}

      {importados.length > 0 && !confirmando ? (
        <Tarjeta>
          <TarjetaEncabezado>
            <TarjetaTitulo>Resultado de la tanda</TarjetaTitulo>
            <TarjetaDescripcion>
              {importados.length} libro(s) importado(s) de {enRevision.length} analizado(s).
            </TarjetaDescripcion>
          </TarjetaEncabezado>

          <TarjetaContenido className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <ResumenCifra
                etiqueta="Órdenes insertadas"
                valor={String(
                  importados.reduce(
                    (total, archivo) => total + (archivo.resultado?.ordenesInsertadas ?? 0),
                    0,
                  ),
                )}
              />
              <ResumenCifra
                etiqueta="Omitidas por duplicado"
                valor={String(
                  importados.reduce(
                    (total, archivo) =>
                      total + (archivo.resultado?.ordenesOmitidasPorDuplicado ?? 0),
                    0,
                  ),
                )}
              />
              <ResumenCifra
                etiqueta="Proveedores creados"
                valor={String(
                  importados.reduce(
                    (total, archivo) => total + (archivo.resultado?.proveedoresCreados ?? 0),
                    0,
                  ),
                )}
              />
              <ResumenCifra
                etiqueta="Proveedores ya existentes"
                valor={String(
                  importados.reduce(
                    (total, archivo) => total + (archivo.resultado?.proveedoresExistentes ?? 0),
                    0,
                  ),
                )}
              />
              <ResumenCifra
                etiqueta="Monto considerado"
                valor={formatearCentavos(
                  importados.reduce(
                    (total, archivo) => total + (archivo.resultado?.summary.consideredCents ?? 0),
                    0,
                  ),
                )}
                destacada
              />
            </div>

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
              Cada lote queda registrado en{' '}
              <Link href="/admin/importaciones" className="underline underline-offset-2">
                Importaciones
              </Link>
              , con su archivo original y sus hallazgos.
            </p>
          </TarjetaContenido>
        </Tarjeta>
      ) : null}
    </div>
  );
}
