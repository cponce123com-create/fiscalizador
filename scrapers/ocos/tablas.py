"""Lectura de tablas HTML, incluidas las de JSF.

SEACE devuelve los resultados en una tabla HTML dentro de una página JavaServer Faces.
No se puede dar por hecho el `id` de la tabla ni el orden de las columnas: cambian
entre versiones del buscador. Por eso el lector es **genérico**:

1. Recoge todas las tablas del documento, respetando las anidadas (JSF las usa).
2. Elige la que contiene los encabezados que se esperan.
3. Traduce cada fila a un diccionario `encabezado -> valor`.

Si no encuentra ninguna tabla con los encabezados esperados, lo dice con un error
explícito en vez de devolver una lista vacía: una lista vacía se confundiría con "no
hay resultados", que es un caso legítimo.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from html.parser import HTMLParser

from .errores import ErrorDeExtraccion


@dataclass
class Tabla:
    """Una tabla con sus filas y celdas."""

    filas: list[list[str]] = field(default_factory=list)

    @property
    def encabezados(self) -> list[str]:
        return self.filas[0] if self.filas else []

    @property
    def cuerpo(self) -> list[list[str]]:
        return self.filas[1:] if self.filas else []

    def parece_vacia(self) -> bool:
        return not self.cuerpo or all(not "".join(fila).strip() for fila in self.cuerpo)


class _LectorDeTablas(HTMLParser):
    """Recoge todas las tablas del documento, incluidas las anidadas."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tablas: list[Tabla] = []
        self._pila: list[Tabla] = []
        self._fila: list[str] | None = None
        self._celda: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "table":
            tabla = Tabla()
            self.tablas.append(tabla)
            self._pila.append(tabla)
        elif tag == "tr" and self._pila:
            self._fila = []
        elif tag in ("td", "th") and self._pila:
            self._celda = []
        elif tag == "br" and self._celda is not None:
            self._celda.append(" ")

    def handle_endtag(self, tag: str) -> None:
        if tag == "table" and self._pila:
            self._pila.pop()
        elif tag == "tr" and self._fila is not None and self._pila:
            self._pila[-1].filas.append(self._fila)
            self._fila = None
        elif tag in ("td", "th") and self._celda is not None:
            texto = re.sub(r"\s+", " ", "".join(self._celda)).strip()
            if self._fila is not None:
                self._fila.append(texto)
            self._celda = None

    def handle_data(self, data: str) -> None:
        if self._celda is not None:
            self._celda.append(data)


def extraer_tablas(html: str) -> list[Tabla]:
    """Todas las tablas del documento."""
    lector = _LectorDeTablas()
    lector.feed(html)
    return lector.tablas


def normalizar_encabezado(texto: str) -> str:
    """Encabezado comparable: sin acentos, sin signos y en minúsculas."""
    sin_acentos = (
        texto.lower()
        .replace("á", "a")
        .replace("é", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ú", "u")
        .replace("ñ", "n")
    )
    return re.sub(r"[^a-z0-9]+", " ", sin_acentos).strip()


def mapear_columnas(encabezados: list[str], columnas: dict[str, list[str]]) -> dict[str, int]:
    """Índice de cada campo, resolviendo antes las coincidencias exactas.

    Cada columna se asigna una sola vez: si no, el alias «proveedor» encajaría dentro de
    «RUC Proveedor» y el nombre del proveedor saldría siendo el RUC.
    """
    normalizados = [normalizar_encabezado(encabezado) for encabezado in encabezados]
    indices: dict[str, int] = {}
    reclamadas: set[int] = set()

    for campo, alias in columnas.items():
        for indice, encabezado in enumerate(normalizados):
            if indice not in reclamadas and encabezado in alias:
                indices[campo] = indice
                reclamadas.add(indice)
                break

    for campo, alias in columnas.items():
        if campo in indices:
            continue
        for indice, encabezado in enumerate(normalizados):
            if indice in reclamadas:
                continue
            if any(nombre in encabezado for nombre in alias):
                indices[campo] = indice
                reclamadas.add(indice)
                break

    return indices


def _buscar_columna(encabezados: list[str], alias: list[str]) -> int | None:
    """Índice de la primera columna cuyo encabezado case con algún alias.

    Sirve para comprobar si una tabla **contiene** las columnas buscadas. Para asignar
    cada campo a una columna se usa `mapear_columnas`, que además reserva las ya usadas.
    """
    normalizados = [normalizar_encabezado(encabezado) for encabezado in encabezados]

    for i, encabezado in enumerate(normalizados):
        for nombre in alias:
            if nombre == encabezado or nombre in encabezado:
                return i
    return None


def elegir_tabla(tablas: list[Tabla], alias_obligatorios: list[list[str]]) -> Tabla | None:
    """La tabla que contiene todos los encabezados pedidos, y la más grande.

    Se prefiere la más grande porque JSF envuelve la tabla de resultados en tablas de
    maquetación que a veces repiten encabezados.
    """
    candidatas: list[Tabla] = []

    for tabla in tablas:
        if len(tabla.filas) < 2:
            continue
        if all(_buscar_columna(tabla.encabezados, alias) is not None for alias in alias_obligatorios):
            candidatas.append(tabla)

    if not candidatas:
        return None

    return max(candidatas, key=lambda tabla: len(tabla.cuerpo))


def leer_resultados(
    html: str,
    *,
    columnas: dict[str, list[str]],
    obligatorias: list[str],
) -> list[dict[str, str]]:
    """Convierte la tabla de resultados en una lista de diccionarios.

    :param columnas: nombre interno -> posibles encabezados.
    :param obligatorias: nombres internos que deben aparecer para aceptar la tabla.
    :raises ErrorDeExtraccion: si no hay ninguna tabla con esos encabezados.
    """
    tablas = extraer_tablas(html)
    tabla = elegir_tabla(tablas, [columnas[nombre] for nombre in obligatorias])

    if tabla is None:
        raise ErrorDeExtraccion(
            "No se encontró la tabla de resultados de SEACE. "
            f"Encabezados exigidos: {', '.join(obligatorias)}. "
            f"Tablas leídas: {len(tablas)}. "
            "Lo más probable es que el buscador haya cambiado o que la respuesta sea un error."
        )

    indices = mapear_columnas(tabla.encabezados, columnas)

    resultados: list[dict[str, str]] = []
    for fila in tabla.cuerpo:
        if not "".join(fila).strip():
            continue

        registro: dict[str, str] = {}
        for nombre, indice in indices.items():
            registro[nombre] = fila[indice] if indice < len(fila) else ""
        resultados.append(registro)

    return resultados


#: Alias de los encabezados de SEACE, en la medida en que se pueden prever.
#: El buscador no está verificado (responde 403 a un cliente simple), así que se
#: incluyen varias formas por si el rótulo cambia.
COLUMNAS_SEACE: dict[str, list[str]] = {
    "orden": ["nro orden", "n orden", "orden", "item"],
    "fecha": ["fecha", "fecha de emision", "fecha emision"],
    "proveedor": ["proveedor", "razon social", "nombre o razon social"],
    "ruc_proveedor": ["ruc proveedor", "ruc del proveedor", "ruc"],
    "objeto": ["objeto", "descripcion", "concepto", "detalle"],
    "monto": ["monto", "importe", "monto total", "valor"],
    "moneda": ["moneda", "tipo de moneda"],
    "estado": ["estado", "situacion"],
}
