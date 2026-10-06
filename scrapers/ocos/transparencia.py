"""Scraper del Portal de Transparencia (PTE).

**Hallazgo de reconocimiento (importante).** La premisa de que esta página publica
libros en Excel/PDF **no se cumple** en la sección de órdenes de compra y servicio. Se
comprobaron cinco entidades (ids 1, 100, 1234, 11129 y 20000) y ninguna devolvió un solo
enlace a un archivo:

* `pte_transparencia_ordenes_compra.aspx` es un **formulario** con dos `select` (año y
  mes) y un botón «Buscar».
* Enviar el formulario por POST devuelve exactamente la misma página, sin resultados.
* El JavaScript de la página (`enviarOsce()`) hace `window.open(...)` a **SEACE** con el
  RUC de la entidad, el año y el mes. Es decir: el portal **delega** en SEACE.

Por eso este módulo hace tres cosas y ninguna inventada:

1. Lee del formulario el RUC de la entidad (campo oculto `id_ruc`) y su nombre.
2. Si la página **sí** trae enlaces a archivos (pasa en otras secciones y en entidades
   que suben documentos), los devuelve para descargarlos.
3. Si no los trae, devuelve el **puente a SEACE** para que el orquestador continúe por
   ahí, en lugar de dar la consulta por vacía.

Devolver "no hay ficheros" cuando en realidad hay que ir a SEACE sería el peor
resultado posible: parecería que la entidad no publica nada.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from .almacenamiento import AlmacenLocal, ArchivoGuardado
from .errores import ErrorDeExtraccion
from .http import ClienteHttp
from .lectores import nombre_seguro
from .logs import REGISTRO, con_contexto
from .modelos import LibroDescargado
from .parseo_html import (
    Enlace,
    extraer_campos_del_formulario,
    extraer_enlaces_de_descarga,
    extraer_puente_seace,
    extraer_titulo,
    resolver_plantilla_seace,
)

BASE = "https://www.transparencia.gob.pe"
RUTA_ORDENES = "/contrataciones/pte_transparencia_ordenes_compra.aspx"

#: Tema 34 = «Contratación de bienes y servicios».
ID_TEMA_CONTRATACIONES = "34"


@dataclass
class InspeccionDeEntidad:
    """Lo que se ha podido averiguar de la página de una entidad."""

    url: str
    ruc: str | None
    nombre: str | None
    enlaces: list[Enlace]
    puente_seace: str | None
    periodos_disponibles: tuple[list[str], list[str]] | None = None

    @property
    def publica_ficheros(self) -> bool:
        return bool(self.enlaces)


class ScraperTransparencia:
    """Lee la página de órdenes de una entidad del PTE."""

    def __init__(self, cliente: ClienteHttp, almacen: AlmacenLocal) -> None:
        self.cliente = cliente
        self.almacen = almacen

    def url_de_ordenes(self, id_entidad: str) -> str:
        return (
            f"{BASE}{RUTA_ORDENES}"
            f"?id_entidad={id_entidad}&id_tema={ID_TEMA_CONTRATACIONES}&Ver=D"
        )

    def inspeccionar(self, id_entidad: str) -> InspeccionDeEntidad:
        """Lee la página de la entidad y saca todo lo aprovechable."""
        url = self.url_de_ordenes(id_entidad)
        respuesta = self.cliente.pedir(url)

        if respuesta.estado != 200:
            raise ErrorDeExtraccion(f"El portal respondió {respuesta.estado} para {url}.")

        html = respuesta.texto
        ocultos, selects = extraer_campos_del_formulario(html)

        ruc = ocultos.get("id_ruc") or None
        nombre = self._nombre_de_la_entidad(html)
        enlaces = extraer_enlaces_de_descarga(html, respuesta.url)
        puente = extraer_puente_seace(html)

        periodos = None
        if selects.get("cbo_anno") or selects.get("cbo_mes"):
            periodos = (selects.get("cbo_anno", []), selects.get("cbo_mes", []))

        if not enlaces and not puente:
            # Ni ficheros ni puente: hay que decirlo, no devolver una lista vacía.
            REGISTRO.warning(
                "La página no tiene enlaces de descarga ni puente a SEACE. "
                "Puede que la entidad no publique órdenes o que el portal haya cambiado.",
                extra=con_contexto(entidad=id_entidad, paso="transparencia"),
            )

        return InspeccionDeEntidad(
            url=respuesta.url,
            ruc=ruc,
            nombre=nombre,
            enlaces=enlaces,
            puente_seace=puente,
            periodos_disponibles=periodos,
        )

    @staticmethod
    def _nombre_de_la_entidad(html: str) -> str | None:
        """Nombre de la entidad, a partir del título.

        El título del portal es del estilo
        «Portal del Estado Peruano - Portal de Transparencia Estándar - PTE <ENTIDAD>».
        """
        titulo = extraer_titulo(html)
        if not titulo:
            return None

        marca = "PTE "
        if marca in titulo:
            return titulo.split(marca, 1)[1].strip() or None

        partes = [parte.strip() for parte in titulo.split("-") if parte.strip()]
        return partes[-1] if partes else None

    def url_del_periodo(self, inspeccion: InspeccionDeEntidad, anio: int, mes: int) -> str | None:
        """URL de SEACE para ese periodo, si la entidad delega en SEACE."""
        if not inspeccion.puente_seace:
            return None

        try:
            return resolver_plantilla_seace(inspeccion.puente_seace, anio=anio, mes=mes)
        except (KeyError, IndexError, ValueError) as error:
            REGISTRO.warning(
                f"No se pudo construir la URL de SEACE desde la plantilla: {error}",
                extra=con_contexto(paso="transparencia"),
            )
            return None

    def descargar_libro(
        self,
        enlace: Enlace,
        *,
        entidad: str,
        anio: int,
        mes: int,
        ruc: str | None = None,
    ) -> LibroDescargado:
        """Descarga un enlace y lo guarda."""
        respuesta = self.cliente.descargar(enlace.absoluto)

        if respuesta.estado != 200:
            raise ErrorDeExtraccion(
                f"Al descargar {enlace.absoluto} el servidor respondió {respuesta.estado}."
            )

        nombre = nombre_seguro(Path(enlace.absoluto.split("?")[0]).name or enlace.texto)
        guardado: ArchivoGuardado = self.almacen.guardar(
            respuesta.contenido,
            origen="transparencia",
            entidad=entidad,
            anio=anio,
            mes=mes,
            nombre=nombre,
        )

        REGISTRO.info(
            f"Descargado {nombre} ({guardado.tamano_bytes} bytes)",
            extra=con_contexto(entidad=entidad, periodo=f"{anio}-{mes:02d}", paso="descarga"),
        )

        return LibroDescargado(
            origen="transparencia",
            entidad_ruc=ruc,
            entidad_nombre=entidad,
            anio=anio,
            mes=mes,
            nombre_archivo=nombre,
            ruta_local=str(guardado.ruta_local) if guardado.ruta_local else None,
            url_origen=enlace.absoluto,
            fecha_descarga=datetime.now(),
            checksum_sha256=guardado.checksum_sha256,
            tamano_bytes=guardado.tamano_bytes,
            tipo_mime=respuesta.tipo_mime,
            notas=f"Enlace: {enlace.texto}" if enlace.texto else None,
        )
