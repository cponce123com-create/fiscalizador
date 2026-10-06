"""Extracción de datos del HTML, sin dependencias externas.

Se usa `html.parser` de la biblioteca estándar en lugar de BeautifulSoup por dos
motivos: el proyecto no necesita un árbol completo, solo recorrer etiquetas; y así la
parte delicada (qué se considera un enlace de descarga, cómo se lee el formulario del
portal) se puede probar sin instalar nada.

Todo lo de este módulo es **puro**: recibe HTML y devuelve datos. Quien descarga es
`transparencia.py`.
"""

from __future__ import annotations

import html as _html
import re
from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import urljoin

#: Extensiones que se consideran "libro descargable".
EXTENSIONES_DE_LIBRO = (".xls", ".xlsx", ".csv", ".pdf", ".doc", ".docx", ".zip")

#: Palabras que, en el texto o en la URL, delatan un enlace de descarga aunque no
#: acabe en una extensión conocida (el portal usa a veces `ObtenerArchivo.aspx?id=`).
PISTAS_DE_DESCARGA = ("obtenerarchivo", "descargar", "download", "archivo", "documento")


@dataclass
class Enlace:
    """Un enlace con su texto visible."""

    href: str
    texto: str
    absoluto: str
    extension: str | None = None
    es_descarga: bool = False


class _LectorDeEnlaces(HTMLParser):
    """Recorre el HTML y recoge los `<a href>` con su texto."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.enlaces: list[tuple[str, str]] = []
        self._href: str | None = None
        self._texto: list[str] = []
        self._titulo: list[str] = []
        self._en_titulo = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "a":
            atributos = dict(attrs)
            href = atributos.get("href")
            if href:
                self._href = href.strip()
                self._texto = []
        elif tag == "title":
            self._en_titulo = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._href is not None:
            self.enlaces.append((self._href, " ".join(self._texto).strip()))
            self._href = None
            self._texto = []
        elif tag == "title":
            self._en_titulo = False

    def handle_data(self, data: str) -> None:
        if self._href is not None:
            self._texto.append(data.strip())
        if self._en_titulo:
            self._titulo.append(data.strip())

    @property
    def titulo(self) -> str:
        return " ".join(parte for parte in self._titulo if parte).strip()


def _extension(href: str) -> str | None:
    sin_parametros = href.split("?", 1)[0].split("#", 1)[0]
    coincidencia = re.search(r"(\.[a-z0-9]{2,5})$", sin_parametros, re.I)
    return coincidencia.group(1).lower() if coincidencia else None


def extraer_enlaces(html: str, base: str) -> list[Enlace]:
    """Todos los enlaces del documento, resueltos a URLs absolutas."""
    lector = _LectorDeEnlaces()
    lector.feed(html)

    enlaces: list[Enlace] = []
    for href, texto in lector.enlaces:
        if not href or href.lower().startswith(("javascript:", "mailto:", "tel:")):
            continue

        absoluto = urljoin(base, href)
        extension = _extension(absoluto)
        pista = any(clave in absoluto.lower() or clave in texto.lower() for clave in PISTAS_DE_DESCARGA)

        enlaces.append(
            Enlace(
                href=href,
                texto=texto,
                absoluto=absoluto,
                extension=extension,
                es_descarga=bool(extension in EXTENSIONES_DE_LIBRO or pista),
            )
        )

    return enlaces


def extraer_enlaces_de_descarga(html: str, base: str) -> list[Enlace]:
    """Solo los enlaces que apuntan a un libro descargable."""
    return [enlace for enlace in extraer_enlaces(html, base) if enlace.es_descarga]


def extraer_titulo(html: str) -> str:
    """Texto de `<title>`, útil para identificar la entidad."""
    lector = _LectorDeEnlaces()
    lector.feed(html)
    return lector.titulo


class _LectorDeFormulario(HTMLParser):
    """Recoge los campos de un formulario: ocultos, selects y sus opciones."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ocultos: dict[str, str] = {}
        self.selects: dict[str, list[str]] = {}
        self._select_actual: str | None = None
        self._nombre_select: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        atributos = dict(attrs)
        if tag == "input" and (atributos.get("type") or "").lower() == "hidden":
            nombre = atributos.get("name")
            if nombre:
                self.ocultos[nombre] = atributos.get("value") or ""
        elif tag == "select":
            nombre = atributos.get("name") or atributos.get("id")
            self._select_actual = nombre
            if nombre:
                self.selects[nombre] = []
        elif tag == "option" and self._select_actual:
            valor = atributos.get("value")
            if valor:
                self.selects[self._select_actual].append(valor)


def extraer_campos_del_formulario(html: str) -> tuple[dict[str, str], dict[str, list[str]]]:
    """Campos ocultos y opciones de los `select`, por nombre.

    El portal publica el RUC de la entidad en un campo oculto (`id_ruc`) y los años y
    meses en dos `select`. Leerlos del propio formulario evita tener que adivinar la
    lista de periodos y, sobre todo, evita inventarse el RUC.
    """
    lector = _LectorDeFormulario()
    lector.feed(html)
    return lector.ocultos, lector.selects


def _primer_argumento(expresion: str) -> str:
    """Recorta una llamada de JavaScript a su primer argumento.

    `window.open` recibe la URL y, después, el destino de la pestaña. Se corta en la
    primera coma que esté **fuera** de comillas, para no romper una URL que lleve una
    coma dentro.
    """
    comilla: str | None = None

    for indice, caracter in enumerate(expresion):
        if comilla is not None:
            if caracter == comilla:
                comilla = None
        elif caracter in ("'", '"'):
            comilla = caracter
        elif caracter == ",":
            return expresion[:indice]

    return expresion


def extraer_puente_seace(html: str) -> str | None:
    """Expresión de la URL de SEACE a la que el portal delega, si lo hace.

    Muchas entidades **no publican ficheros**: su página de órdenes es un formulario que
    abre el buscador público de SEACE en otra pestaña. La URL se construye en el
    JavaScript de la página, así que se busca ahí.

    Devuelve la **expresión completa**, no solo su primer trozo: la URL viene partida en
    concatenaciones y quedarse con el primer literal perdería el año y el mes.
    """
    coincidencia = re.search(r"""window\.open\((.+?)\)""", html, re.I | re.S)
    if coincidencia:
        return _primer_argumento(coincidencia.group(1).strip()) or None

    # Variante sin window.open: una URL de SEACE suelta en el documento.
    coincidencia = re.search(r"""['"](https?://[^'"]*seace\.gob\.pe[^'"]*)['"]""", html, re.I)
    return coincidencia.group(1) if coincidencia else None


def resolver_plantilla_seace(
    plantilla: str, *, anio: int, mes: int, ruc: str | None = None
) -> str:
    """Convierte la expresión del JavaScript en una URL con el año y el mes puestos.

    Primero se quitan las comillas (dejan de separar trozos) y luego se cambian las
    variables del JavaScript por su valor. El mes va con dos dígitos porque es lo que
    espera SEACE (`mes=06`, no `mes=6`).
    """
    sin_comillas = plantilla.replace("'", "").replace('"', "")

    url = re.sub(r"\s*\+\s*year\s*\+\s*", "{anio}", sin_comillas)
    url = re.sub(r"\s*\+\s*month\s*\+\s*", "{mes}", url)
    url = re.sub(r"\s*\+\s*ruc\s*\+\s*", "{ruc}", url)

    return url.format(anio=anio, mes=f"{mes:02d}", ruc=ruc or "")


def texto_visible(html: str) -> str:
    """Texto del documento sin etiquetas ni espacios repetidos."""
    sin_scripts = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    sin_etiquetas = re.sub(r"<[^>]+>", " ", sin_scripts)
    return re.sub(r"\s+", " ", _html.unescape(sin_etiquetas)).strip()
