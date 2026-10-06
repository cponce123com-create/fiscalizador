"""Orquestador: lee la configuración y ejecuta todo.

Responsabilidades:

* Recorrer entidades y periodos, y decidir por qué vía se obtiene cada uno.
* Limitar la concurrencia (por defecto **1**: los servidores públicos no son un banco
  de pruebas; subirla es una decisión consciente).
* Aislar los fallos: que una entidad falle no puede impedir que se procesen las demás.
* Escribir los resultados en CSV y JSON, y avisar al final.
"""

from __future__ import annotations

import csv
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from .almacenamiento import AlmacenLocal, crear_almacenamiento
from .captcha import crear_resolvedor
from .config import Configuracion, Entidad, Periodo
from .errores import ErrorOCOS
from .http import ClienteHttp
from .lectores import leer
from .logs import REGISTRO, con_contexto
from .modelos import LibroDescargado, OrdenNormalizada, ResultadoEjecucion
from .normalizador import normalizar_filas
from .notificaciones import notificar
from .reintentos import PoliticaReintentos
from .seace import ScraperSeace, fila_a_diccionario_crudo
from .transparencia import ScraperTransparencia

#: Cabeceras del CSV de salida, en el orden en que se leen.
CABECERAS_CSV = [
    "ruc_entidad",
    "entidad",
    "ruc_proveedor",
    "proveedor",
    "monto",
    "moneda",
    "fecha",
    "objeto",
    "estado",
    "origen",
    "archivo_origen",
    "fila_origen",
    "anio",
    "mes",
    "avisos",
]


@dataclass
class TareaDePeriodo:
    """Una entidad en un periodo concreto."""

    entidad: Entidad
    periodo: Periodo

    @property
    def etiqueta(self) -> str:
        return f"{self.entidad.nombre} {self.periodo.etiqueta}"


class Orquestador:
    """Coordina los scrapers según la configuración."""

    def __init__(self, configuracion: Configuracion) -> None:
        self.config = configuracion

        politica = PoliticaReintentos(
            intentos=configuracion.red.reintentos,
            espera_inicial=configuracion.red.espera_inicial,
            espera_maxima=configuracion.red.espera_maxima,
        )

        self.cliente = ClienteHttp(
            segundos_entre_peticiones=configuracion.red.segundos_entre_peticiones,
            timeout=configuracion.red.timeout,
            user_agent=configuracion.red.user_agent,
            politica=politica,
        )

        self.almacen = crear_almacenamiento(
            configuracion.almacenamiento.driver,
            directorio_base=configuracion.almacenamiento.directorio_base,
            bucket=configuracion.almacenamiento.bucket,
            prefijo=configuracion.almacenamiento.prefijo,
        )
        self.almacen_local = AlmacenLocal(configuracion.almacenamiento.directorio_base)

        self.transparencia = ScraperTransparencia(self.cliente, self.almacen_local)

    def _seace(self) -> ScraperSeace:
        """Construye el scraper de SEACE solo cuando hace falta.

        Así, una corrida que no toque SEACE no necesita Playwright instalado.
        """
        resolvedor = crear_resolvedor(
            self.config.captcha.resolvedor,
            directorio_de_respaldo=self.config.captcha.directorio_de_respaldo,
            segundos_de_espera=self.config.captcha.espera_manual,
        )

        return ScraperSeace(
            resolvedor=resolvedor,
            intentos_de_captcha=self.config.captcha.intentos,
            navegador_visible=self.config.red.navegador_visible,
            timeout=self.config.red.timeout_navegador,
        )

    # --- Planificación ----------------------------------------------------------

    def tareas(self, *, solo_entidad: str | None = None, solo_periodo: str | None = None) -> list[TareaDePeriodo]:
        """Lista de (entidad, periodo) a procesar."""
        tareas: list[TareaDePeriodo] = []

        for entidad in self.config.entidades:
            if solo_entidad and entidad.nombre != solo_entidad:
                continue

            for periodo in entidad.periodos:
                if solo_periodo and periodo.etiqueta != solo_periodo:
                    continue
                tareas.append(TareaDePeriodo(entidad=entidad, periodo=periodo))

        return tareas

    # --- Ejecución --------------------------------------------------------------

    def ejecutar(
        self,
        *,
        solo_entidad: str | None = None,
        solo_periodo: str | None = None,
        solo_origen: str | None = None,
    ) -> ResultadoEjecucion:
        """Ejecuta todo y devuelve el resumen."""
        resultado = ResultadoEjecucion(iniciado_en=datetime.now())
        tareas = self.tareas(solo_entidad=solo_entidad, solo_periodo=solo_periodo)

        REGISTRO.info(
            f"Plan: {len(tareas)} combinación(es) de entidad y periodo.",
            extra=con_contexto(paso="orquestador"),
        )

        concurrencia = max(1, self.config.red.concurrencia)

        if concurrencia == 1:
            for tarea in tareas:
                self._procesar(tarea, resultado, solo_origen=solo_origen)
        else:
            with ThreadPoolExecutor(max_workers=concurrencia) as ejecutor:
                futuros = {
                    ejecutor.submit(self._procesar, tarea, resultado, solo_origen=solo_origen): tarea
                    for tarea in tareas
                }
                for futuro in as_completed(futuros):
                    tarea = futuros[futuro]
                    try:
                        futuro.result()
                    except Exception as error:  # ya se anota dentro; esto es la red de seguridad
                        resultado.errores.append(f"{tarea.etiqueta}: {error}")

        resultado.terminado_en = datetime.now()
        self._escribir_salidas(resultado)

        notificar(
            resultado,
            email_para=self.config.notificacion.email_para,
            slack_webhook=self.config.notificacion.slack_webhook,
            solo_si_hay_errores=self.config.notificacion.solo_si_hay_errores,
        )

        return resultado

    def _procesar(
        self,
        tarea: TareaDePeriodo,
        resultado: ResultadoEjecucion,
        *,
        solo_origen: str | None = None,
    ) -> None:
        """Procesa una combinación de entidad y periodo, aislando los fallos."""
        etiqueta = tarea.etiqueta
        contexto = con_contexto(entidad=tarea.entidad.nombre, periodo=tarea.periodo.etiqueta)

        try:
            if "transparencia" in tarea.entidad.origenes and solo_origen in (None, "transparencia"):
                self._por_transparencia(tarea, resultado)

            if "seace" in tarea.entidad.origenes and solo_origen in (None, "seace"):
                self._por_seace(tarea, resultado)
        except ErrorOCOS as error:
            # Error previsto: se anota y se sigue con la siguiente tarea.
            REGISTRO.error(f"{etiqueta}: {error}", extra=contexto)
            resultado.errores.append(f"{etiqueta}: {error}")
        except Exception as error:  # noqa: BLE001 - un fallo inesperado no debe tumbar la corrida
            REGISTRO.exception(f"{etiqueta}: fallo inesperado", extra=contexto)
            resultado.errores.append(f"{etiqueta}: fallo inesperado ({error})")

    def _por_transparencia(self, tarea: TareaDePeriodo, resultado: ResultadoEjecucion) -> None:
        """Vía del Portal de Transparencia."""
        id_entidad = tarea.entidad.id_transparencia
        if not id_entidad:
            resultado.advertencias.append(
                f"{tarea.etiqueta}: sin «id_transparencia», se omite esta vía."
            )
            return

        inspeccion = self.transparencia.inspeccionar(id_entidad)

        if not inspeccion.publica_ficheros:
            # El portal delega en SEACE: se deja dicho, no se da por vacío.
            resultado.advertencias.append(
                f"{tarea.etiqueta}: el portal no publica ficheros; delega en SEACE"
                + (f" ({inspeccion.puente_seace})" if inspeccion.puente_seace else "")
            )
            return

        for enlace in inspeccion.enlaces:
            libro = self.transparencia.descargar_libro(
                enlace,
                entidad=tarea.entidad.nombre,
                anio=tarea.periodo.anio,
                mes=tarea.periodo.mes,
                ruc=inspeccion.ruc,
            )
            resultado.libros.append(libro)
            resultado.ordenes.extend(self._normalizar_libro(libro, tarea.entidad))

    def _por_seace(self, tarea: TareaDePeriodo, resultado: ResultadoEjecucion) -> None:
        """Vía de SEACE."""
        if not tarea.entidad.ruc:
            resultado.advertencias.append(f"{tarea.etiqueta}: sin RUC, se omite SEACE.")
            return

        scraper = self._seace()
        consulta = scraper.consultar(tarea.entidad.ruc, tarea.periodo.anio, tarea.periodo.mes)

        if not consulta.filas:
            resultado.advertencias.append(f"{tarea.etiqueta}: SEACE no devolvió filas.")
            return

        filas_crudas = [fila_a_diccionario_crudo(fila) for fila in consulta.filas]
        encabezados = list(filas_crudas[0].keys())
        datos = [[fila[clave] for clave in encabezados] for fila in filas_crudas]

        ordenes = normalizar_filas(
            datos,
            encabezados,
            origen="seace",
            archivo=f"seace:{tarea.entidad.ruc}:{tarea.periodo.etiqueta}",
            anio=tarea.periodo.anio,
            mes=tarea.periodo.mes,
            entidad_por_defecto=tarea.entidad.nombre,
            ruc_entidad_por_defecto=tarea.entidad.ruc,
        )

        resultado.ordenes.extend(ordenes)
        REGISTRO.info(
            f"SEACE: {len(ordenes)} órdenes normalizadas",
            extra=con_contexto(entidad=tarea.entidad.nombre, periodo=tarea.periodo.etiqueta),
        )

    def _normalizar_libro(
        self, libro: LibroDescargado, entidad: Entidad
    ) -> list[OrdenNormalizada]:
        """Lee el archivo descargado y lo normaliza."""
        if not libro.ruta_local:
            return []

        try:
            encabezados, filas = leer(libro.ruta_local)
        except ErrorOCOS as error:
            REGISTRO.warning(
                f"No se pudo leer {libro.nombre_archivo}: {error}",
                extra=con_contexto(entidad=entidad.nombre),
            )
            return []

        if not encabezados:
            return []

        return normalizar_filas(
            filas,
            encabezados,
            origen="transparencia",
            archivo=libro.nombre_archivo,
            anio=libro.anio,
            mes=libro.mes,
            entidad_por_defecto=entidad.nombre,
            ruc_entidad_por_defecto=entidad.ruc,
        )

    # --- Salidas ----------------------------------------------------------------

    def _directorio_de_salida(self) -> Path:
        directorio = Path(self.config.almacenamiento.directorio_base) / "datos"
        directorio.mkdir(parents=True, exist_ok=True)
        return directorio

    def _escribir_salidas(self, resultado: ResultadoEjecucion) -> None:
        """Escribe CSV, JSON y el inventario de archivos descargados."""
        directorio = self._directorio_de_salida()
        marca = resultado.iniciado_en.strftime("%Y%m%d-%H%M%S")

        csv_ordenes = directorio / f"ordenes-{marca}.csv"
        with csv_ordenes.open("w", encoding="utf-8", newline="") as archivo:
            escritor = csv.DictWriter(archivo, fieldnames=CABECERAS_CSV)
            escritor.writeheader()
            for orden in resultado.ordenes:
                fila = orden.a_diccionario()
                fila["avisos"] = " | ".join(orden.avisos)
                escritor.writerow({clave: fila.get(clave) for clave in CABECERAS_CSV})

        json_ordenes = directorio / f"ordenes-{marca}.json"
        json_ordenes.write_text(
            json.dumps(
                [{**orden.a_diccionario(), "avisos": orden.avisos} for orden in resultado.ordenes],
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        json_libros = directorio / f"libros-{marca}.json"
        json_libros.write_text(
            json.dumps([libro.a_diccionario() for libro in resultado.libros], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        json_resumen = directorio / f"resumen-{marca}.json"
        json_resumen.write_text(
            json.dumps(resultado.resumen(), ensure_ascii=False, indent=2), encoding="utf-8"
        )

        REGISTRO.info(
            f"Escrito: {csv_ordenes.name}, {json_ordenes.name}, {json_libros.name} y {json_resumen.name}",
            extra=con_contexto(paso="salida"),
        )
