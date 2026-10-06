"""Scraper de la Plataforma Nacional de Datos Abiertos.

Es la **mejor** de las tres fuentes, y por eso está aquí:

* No hay captcha ni WAF: es una web pública que se deja leer.
* Los datos vienen en CSV o Excel, ya tabulados: no hay que interpretar una pantalla.
* Cada entidad publica su propio conjunto, con su diccionario de datos.

Lo que se comprobó antes de escribir esto (2026-10-06):

* `contratacionesabiertas.osce.gob.pe`, que se barajaba como alternativa, **no resuelve**:
  el dominio ya no existe.
* `www.datosabiertos.gob.pe` responde y es un Drupal, **no un CKAN**: no hay API
  `package_search`, así que la búsqueda se hace sobre el HTML.
* Buscando «ordenes de compra» salen más de diez conjuntos de entidades reales (GORE
  Áncash, GORE Callao, GORE Tacna, Municipalidad de Magdalena, Chaclacayo, Jorge Basadre,
  Paita…).
* Un conjunto real (GORE Áncash) trae 4.142 filas con estas columnas:
  `TIPO_ORDEN, ANNO_ORDEN, NRO_MES_ORDEN, ORDEN_RUC, ORDEN_FECHA, ORDEN_MONTO,
  ORDEN_PROVEEDOR, ORDEN_DESCRIPCION, DEPARTAMENTO, PROVINCIA, DISTRITO, UBIGEO,
  FECHA_CORTE`.

Dos avisos que ahorran sorpresas:

1. **El conjunto no dice de qué entidad es.** El nombre y el RUC hay que aportarlos en la
   configuración: el fichero solo trae los datos, no quién los publica.
2. **No todos los enlaces del conjunto son datos.** Junto al CSV vienen el diccionario de
   datos y los metadatos. Se descartan por nombre, porque si no se acabaría intentando
   normalizar un `.docx`.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Iterable

from .almacenamiento import AlmacenLocal, ArchivoGuardado
from .errores import ErrorDeExtraccion
from .http import ClienteHttp
from .lectores import nombre_seguro
from .logs import REGISTRO, con_contexto
from .modelos import LibroDescargado
from .parseo_html import Enlace, extraer_enlaces, extraer_titulo

BASE = "https://www.datosabiertos.gob.pe"
RUTA_BUSQUEDA = "/search/type/dataset"

#: Extensiones que se consideran datos tabulables.
FORMATOS_DE_DATOS = (".csv", ".xlsx", ".xls", ".ods", ".json", ".zip")

#: Palabras que delatan un archivo que **no** son los datos.
NOMBRES_A_DESCARTAR = ("diccionario", "metadatos", "metadata", "ley", "instructivo", "manual")


@dataclass
class Recurso:
    """Un archivo publicado dentro de un conjunto de datos."""

    url: str
    texto: str = ""
    formato: str | None = None

    @property
    def nombre(self) -> str:
        return Path(self.url.split("?")[0]).name

    def es_de_datos(self) -> bool:
        """¿Es el archivo de datos, y no un anexo?

        Los conjuntos publican el CSV junto al diccionario de datos y los metadatos. Sin
        este filtro se intentaría normalizar un `.docx`.
        """
        if self.formato not in FORMATOS_DE_DATOS:
            return False

        en_nombre = self.nombre.lower()
        return not any(palabra in en_nombre for palabra in NOMBRES_A_DESCARTAR)


@dataclass
class ConjuntoDeDatos:
    """Un conjunto de datos con sus archivos."""

    url: str
    titulo: str | None = None
    recursos: list[Recurso] = field(default_factory=list)

    @property
    def recursos_de_datos(self) -> list[Recurso]:
        return [recurso for recurso in self.recursos if recurso.es_de_datos()]

    @property
    def anexos(self) -> list[Recurso]:
        return [recurso for recurso in self.recursos if not recurso.es_de_datos()]


def _formato(url: str) -> str | None:
    coincidencia = re.search(r"(\.[a-z0-9]{2,5})$", url.split("?")[0].split("#")[0], re.I)
    return coincidencia.group(1).lower() if coincidencia else None


def recursos_de_la_pagina(html: str, base: str = BASE) -> list[Recurso]:
    """Enlaces de descarga de una página de conjunto de datos.

    Se aceptan tanto los que acaban en una extensión conocida como los que pasan por
    `/sites/default/files/`, que es donde los guarda el portal.
    """
    recursos: list[Recurso] = []

    for enlace in extraer_enlaces(html, base):
        formato = _formato(enlace.absoluto)
        es_fichero = formato in FORMATOS_DE_DATOS
        es_ruta_de_ficheros = "/sites/default/files/" in enlace.absoluto

        if es_fichero or (es_ruta_de_ficheros and formato):
            recursos.append(Recurso(url=enlace.absoluto, texto=enlace.texto, formato=formato))

    return recursos


def conjuntos_de_la_busqueda(html: str, base: str = BASE) -> list[tuple[str, str]]:
    """Pares (url, título) de los conjuntos que lista una búsqueda.

    El portal es un Drupal sin API, así que se leen los enlaces a `/dataset/`.
    """
    encontrados: list[tuple[str, str]] = []
    vistos: set[str] = set()

    for enlace in extraer_enlaces(html, base):
        if "/dataset/" not in enlace.absoluto or enlace.absoluto in vistos:
            continue
        vistos.add(enlace.absoluto)
        encontrados.append((enlace.absoluto, enlace.texto))

    return encontrados


def exigir_recursos_de_datos(conjunto: ConjuntoDeDatos) -> list[Recurso]:
    """Los archivos de datos del conjunto, o un error que explica por qué no hay.

    Se comprueba aquí, y no dentro del scraper, para poder probarlo sin red. El caso es
    real: una entidad puede subir el diccionario de datos y olvidarse del fichero de
    datos, y entonces hay que decirlo en lugar de devolver una lista vacía que parecería
    "no hay órdenes".
    """
    recursos = conjunto.recursos_de_datos

    if not recursos:
        nombres = ', '.join(recurso.nombre for recurso in conjunto.recursos) or 'ninguno'
        raise ErrorDeExtraccion(
            f"El conjunto {conjunto.url} no publica ningún archivo de datos. "
            f"Enlaces leídos: {len(conjunto.recursos)} ({nombres}). "
            "Puede que la entidad solo haya subido el diccionario de datos."
        )

    return recursos


class ScraperDatosAbiertos:
    """Lee los conjuntos de datos abiertos de órdenes de compra y servicio."""

    def __init__(self, cliente: ClienteHttp, almacen: AlmacenLocal) -> None:
        self.cliente = cliente
        self.almacen = almacen

    def url_de_busqueda(self, consulta: str) -> str:
        return f"{BASE}{RUTA_BUSQUEDA}?query={consulta.replace(' ', '+')}"

    def buscar(self, consulta: str = "ordenes de compra y servicio") -> list[tuple[str, str]]:
        """Conjuntos de datos que responden a la consulta."""
        respuesta = self.cliente.pedir(self.url_de_busqueda(consulta))

        if respuesta.estado != 200:
            raise ErrorDeExtraccion(
                f"La búsqueda en datos abiertos respondió {respuesta.estado}."
            )

        conjuntos = conjuntos_de_la_busqueda(respuesta.texto, respuesta.url)
        REGISTRO.info(
            f"La búsqueda devolvió {len(conjuntos)} conjunto(s).",
            extra=con_contexto(paso="datosabiertos"),
        )
        return conjuntos

    def inspeccionar(self, url: str) -> ConjuntoDeDatos:
        """Lee la página de un conjunto y saca sus archivos.

        :raises ErrorDeExtraccion: si el conjunto no publica ningún archivo de datos.
        """
        respuesta = self.cliente.pedir(url)

        if respuesta.estado != 200:
            raise ErrorDeExtraccion(f"El conjunto {url} respondió {respuesta.estado}.")

        conjunto = ConjuntoDeDatos(
            url=respuesta.url,
            titulo=extraer_titulo(respuesta.texto) or None,
            recursos=recursos_de_la_pagina(respuesta.texto, respuesta.url),
        )

        exigir_recursos_de_datos(conjunto)

        return conjunto

    def descargar(
        self,
        recurso: Recurso,
        *,
        entidad: str,
        anio: int,
        mes: int,
        ruc: str | None = None,
    ) -> LibroDescargado:
        """Descarga un recurso y lo guarda."""
        respuesta = self.cliente.descargar(recurso.url)

        if respuesta.estado != 200:
            raise ErrorDeExtraccion(
                f"Al descargar {recurso.url} el servidor respondió {respuesta.estado}."
            )

        nombre = nombre_seguro(recurso.nombre or "datos.csv")
        guardado: ArchivoGuardado = self.almacen.guardar(
            respuesta.contenido,
            origen="datosabiertos",
            entidad=entidad,
            anio=anio,
            mes=mes,
            nombre=nombre,
        )

        REGISTRO.info(
            f"Descargado {nombre} ({guardado.tamano_bytes} bytes)",
            extra=con_contexto(entidad=entidad, paso="datosabiertos"),
        )

        return LibroDescargado(
            origen="datosabiertos",
            entidad_ruc=ruc,
            entidad_nombre=entidad,
            anio=anio,
            mes=mes,
            nombre_archivo=nombre,
            ruta_local=str(guardado.ruta_local) if guardado.ruta_local else None,
            url_origen=recurso.url,
            fecha_descarga=datetime.now(),
            checksum_sha256=guardado.checksum_sha256,
            tamano_bytes=guardado.tamano_bytes,
            tipo_mime=respuesta.tipo_mime,
            notas="Conjunto de datos abiertos",
        )


def anios_del_conjunto(recursos: Iterable[Recurso]) -> list[int]:
    """Años que aparecen en los nombres de los archivos.

    Sirve para comprobar de un vistazo si un conjunto cubre el periodo que se busca antes
    de descargar nada.
    """
    anios: set[int] = set()

    for recurso in recursos:
        for coincidencia in re.finditer(r"(20\d{2})", recurso.nombre):
            anios.add(int(coincidencia.group(1)))

    return sorted(anios)
