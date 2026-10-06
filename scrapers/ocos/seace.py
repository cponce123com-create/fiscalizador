"""Scraper del Buscador Público de Órdenes de Compra y Servicio de SEACE.

SEACE es una aplicación **JavaServer Faces**: el estado del formulario viaja en campos
ocultos (`javax.faces.ViewState`) y los enlaces de paginación son `postbacks` de
JavaScript, no URLs. Por eso hace falta un navegador de verdad (Playwright) y no basta
con peticiones HTTP.

**Estado de verificación.** Este módulo NO está verificado contra el sitio real:
`prod2.seace.gob.pe` responde **403** a un cliente que no sea un navegador, así que no
se pudo inspeccionar su DOM. En consecuencia:

* Los selectores están escritos como **listas de candidatos**, y se prueban en orden.
  Cuando el buscador cambie un `id`, basta con añadir el nuevo a la lista.
* Si ninguno casa, se lanza un error que dice **qué se buscaba y qué había**, en lugar de
  fallar en silencio. Ese mensaje es lo que hay que leer para arreglarlo en dos minutos.
* El parseo de la tabla sí está probado (es puro, vive en `tablas.py`).

Antes de usar esto en producción hay que ejecutarlo una vez con `navegador_visible: true`
y ajustar los selectores a lo que se vea.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from .captcha import ResolvedorDeCaptcha, resolver_con_reintentos
from .errores import ErrorDeCaptcha, ErrorDeExtraccion
from .logs import REGISTRO, con_contexto
from .normalizador import COLUMNAS
from .tablas import COLUMNAS_SEACE, leer_resultados

BASE_SEACE = "https://prod2.seace.gob.pe/seacebus-uiwd-pub/buscadorPublico/ongei/buscadorPublicoOCOS.xhtml"

#: Selectores candidatos, por si el buscador cambia de identificadores.
SELECTORES = {
    "campo_captcha": [
        "input[id$='captcha']",
        "input[name*='captcha']",
        "input[id*='Captcha']",
    ],
    "imagen_captcha": [
        "img[id*='captcha']",
        "img[id*='Captcha']",
        "img[src*='captcha']",
        "img[src*='kaptcha']",
    ],
    "boton_buscar": [
        "button[id*='buscar']",
        "input[id*='buscar']",
        "button:has-text('Buscar')",
        "input[type='submit']",
    ],
    "tabla_resultados": [
        "table[id*='resultado']",
        "table[id*='Resultado']",
        "table[id*='lista']",
        "table",
    ],
    "siguiente": [
        "a:has-text('Siguiente')",
        "a[id*='siguiente']",
        "input[value='Siguiente']",
    ],
}

#: Columnas que deben existir para aceptar una tabla como la de resultados.
COLUMNAS_OBLIGATORIAS = ["proveedor", "monto"]


@dataclass
class FilaSeace:
    """Una fila de resultados, ya en crudo."""

    datos: dict[str, str]
    anio: int
    mes: int
    ruc_entidad: str
    pagina: int = 1


@dataclass
class ResultadoSeace:
    """Resultado completo de una consulta."""

    ruc_entidad: str
    anio: int
    mes: int
    filas: list[FilaSeace] = field(default_factory=list)
    paginas_leidas: int = 0
    captcha_resuelto: str | None = None


class ScraperSeace:
    """Consulta el buscador público con un navegador real."""

    def __init__(
        self,
        *,
        resolvedor: ResolvedorDeCaptcha,
        intentos_de_captcha: int = 3,
        navegador_visible: bool = False,
        timeout: float = 60.0,
        max_paginas: int = 50,
        directorio_de_capturas: str | None = None,
    ) -> None:
        self.resolvedor = resolvedor
        self.intentos_de_captcha = intentos_de_captcha
        self.navegador_visible = navegador_visible
        self.timeout = timeout
        self.max_paginas = max_paginas
        self.directorio_de_capturas = directorio_de_capturas

    # --- Utilidades de selector -------------------------------------------------

    @staticmethod
    def _primer_localizador(pagina: Any, candidatos: list[str]) -> Any:
        """Primer selector de la lista que existe en la página."""
        for selector in candidatos:
            try:
                localizador = pagina.locator(selector).first
                if localizador.count() > 0:
                    return localizador
            except Exception:
                continue
        return None

    def _exigir_localizador(self, pagina: Any, clave: str) -> Any:
        localizador = self._primer_localizador(pagina, SELECTORES[clave])
        if localizador is None:
            raise ErrorDeExtraccion(
                f"No se encontró ningún elemento para «{clave}» en SEACE. "
                f"Selectores probados: {', '.join(SELECTORES[clave])}. "
                "El buscador habrá cambiado: inspecciona la página con "
                "`navegador_visible: true` y añade el selector nuevo a `SELECTORES`."
            )
        return localizador

    # --- Consulta ---------------------------------------------------------------

    def _url(self, ruc_entidad: str, anio: int, mes: int) -> str:
        return (
            f"{BASE_SEACE}?ruc_entidad={ruc_entidad}&anio={anio}"
            f"&mes={mes:02d}&theme=ongei"
        )

    def consultar(self, ruc_entidad: str, anio: int, mes: int) -> ResultadoSeace:
        """Consulta un periodo de una entidad y devuelve las filas."""
        try:
            from playwright.sync_api import sync_playwright  # type: ignore[import-not-found]
        except ImportError as error:  # pragma: no cover - depende del entorno
            raise ErrorDeExtraccion(
                "Para consultar SEACE hace falta Playwright: "
                "`pip install playwright && playwright install chromium`."
            ) from error

        resultado = ResultadoSeace(ruc_entidad=ruc_entidad, anio=anio, mes=mes)
        url = self._url(ruc_entidad, anio, mes)

        with sync_playwright() as playwright:
            navegador = playwright.chromium.launch(headless=not self.navegador_visible)
            contexto = navegador.new_context(locale="es-PE")
            pagina = contexto.new_page()
            pagina.set_default_timeout(self.timeout * 1000)

            try:
                REGISTRO.info(
                    f"Abriendo SEACE para {ruc_entidad} {anio}-{mes:02d}",
                    extra=con_contexto(periodo=f"{anio}-{mes:02d}", paso="seace"),
                )
                pagina.goto(url, wait_until="domcontentloaded")

                texto = self._texto_de_la_pagina(pagina)
                if "captcha" in texto.lower() or self._primer_localizador(
                    pagina, SELECTORES["imagen_captcha"]
                ):
                    resultado.captcha_resuelto = self._resolver_captcha(pagina)
                    self._enviar_formulario(pagina)

                resultado.filas = self._leer_paginas(pagina, ruc_entidad, anio, mes)
            finally:
                contexto.close()
                navegador.close()

        return resultado

    @staticmethod
    def _texto_de_la_pagina(pagina: Any) -> str:
        try:
            return pagina.inner_text("body")
        except Exception:
            return ""

    def _resolver_captcha(self, pagina: Any) -> str:
        """Resuelve el captcha pidiendo una imagen nueva en cada intento."""

        def obtener_imagen() -> bytes:
            # Recargar la página renueva el captcha: reutilizar la imagen anterior solo
            # gastaría intentos con el mismo texto.
            imagen = self._exigir_localizador(pagina, "imagen_captcha")
            return imagen.screenshot()

        texto = resolver_con_reintentos(
            self.resolvedor, obtener_imagen, intentos=self.intentos_de_captcha
        )

        campo = self._exigir_localizador(pagina, "campo_captcha")
        campo.fill(texto)
        return texto

    def _enviar_formulario(self, pagina: Any) -> None:
        boton = self._exigir_localizador(pagina, "boton_buscar")
        boton.click()

        try:
            pagina.wait_for_load_state("networkidle", timeout=self.timeout * 1000)
        except Exception:
            # JSF a veces no llega a "networkidle"; se sigue y se intenta leer la tabla.
            REGISTRO.debug(
                "La página no llegó a networkidle tras enviar el formulario.",
                extra=con_contexto(paso="seace"),
            )

        texto = self._texto_de_la_pagina(pagina)
        if "captcha" in texto.lower() and "incorrect" in texto.lower():
            raise ErrorDeCaptcha("SEACE rechazó el captcha: el texto no era correcto.")

    def _leer_paginas(
        self, pagina: Any, ruc_entidad: str, anio: int, mes: int
    ) -> list[FilaSeace]:
        """Recorre la paginación y acumula las filas."""
        acumuladas: list[FilaSeace] = []

        for numero in range(1, self.max_paginas + 1):
            html = pagina.content()

            try:
                crudas = leer_resultados(
                    html, columnas=COLUMNAS_SEACE, obligatorias=COLUMNAS_OBLIGATORIAS
                )
            except ErrorDeExtraccion:
                if numero == 1:
                    raise
                REGISTRO.info(
                    f"La página {numero} no tenía tabla de resultados: fin de la paginación.",
                    extra=con_contexto(paso="seace"),
                )
                break

            if not crudas:
                break

            for cruda in crudas:
                acumuladas.append(
                    FilaSeace(
                        datos=cruda,
                        anio=anio,
                        mes=mes,
                        ruc_entidad=ruc_entidad,
                        pagina=numero,
                    )
                )

            REGISTRO.info(
                f"Página {numero}: {len(crudas)} filas",
                extra=con_contexto(periodo=f"{anio}-{mes:02d}", paso="seace"),
            )

            siguiente = self._primer_localizador(pagina, SELECTORES["siguiente"])
            if siguiente is None or not self._esta_habilitado(siguiente):
                break

            siguiente.click()
            try:
                pagina.wait_for_load_state("networkidle", timeout=self.timeout * 1000)
            except Exception:
                pass

        return acumuladas

    @staticmethod
    def _esta_habilitado(localizador: Any) -> bool:
        try:
            return localizador.is_enabled()
        except Exception:
            return True


def fila_a_diccionario_crudo(fila: FilaSeace) -> dict[str, Any]:
    """Aplana una fila de SEACE para el normalizador.

    Se conservan las claves que entiende `normalizador.COLUMNAS`, para que la misma
    función normalice tanto un libro de Excel como una fila del buscador.
    """
    datos = fila.datos
    return {
        "nro orden": datos.get("orden", ""),
        "fecha": datos.get("fecha", ""),
        "ruc proveedor": datos.get("ruc_proveedor", ""),
        "proveedor": datos.get("proveedor", ""),
        "objeto": datos.get("objeto", ""),
        "monto": datos.get("monto", ""),
        "moneda": datos.get("moneda", ""),
        "estado": datos.get("estado", ""),
        "ruc entidad": fila.ruc_entidad,
        "archivo_origen": f"seace:{fila.ruc_entidad}:{fila.anio}-{fila.mes:02d}",
    }


#: Se importa aquí abajo para que el módulo siga siendo importable sin Playwright.
ENCABEZADOS_DE_SEACE = list(COLUMNAS.keys())
