"""Modelos de datos del scraper.

Dos piezas separadas a propósito:

* `LibroDescargado` describe **el archivo** (de dónde salió, cuándo se bajó, su
  checksum). Es la trazabilidad: permite volver al origen de cualquier cifra.
* `OrdenNormalizada` describe **una fila** ya convertida al formato común, que es lo
  que se entrega a quien consuma los datos.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any

#: Campos que el pliego exige en la salida normalizada.
CAMPOS_OBLIGATORIOS = (
    "ruc_entidad",
    "entidad",
    "ruc_proveedor",
    "proveedor",
    "monto",
    "moneda",
    "fecha",
    "objeto",
    "estado",
)


@dataclass
class LibroDescargado:
    """Un archivo descargado, con su procedencia."""

    origen: str
    entidad_ruc: str | None
    entidad_nombre: str | None
    anio: int
    mes: int
    nombre_archivo: str
    ruta_local: str | None
    url_origen: str
    fecha_descarga: datetime
    checksum_sha256: str | None = None
    tamano_bytes: int | None = None
    tipo_mime: str | None = None
    notas: str | None = None

    def a_diccionario(self) -> dict[str, Any]:
        datos = asdict(self)
        datos["fecha_descarga"] = self.fecha_descarga.isoformat()
        return datos


@dataclass
class OrdenNormalizada:
    """Una orden de compra o de servicio en el formato común."""

    ruc_entidad: str | None
    entidad: str | None
    ruc_proveedor: str | None
    proveedor: str | None
    monto: Decimal | None
    moneda: str
    fecha: date | None
    objeto: str | None
    estado: str | None

    # Trazabilidad: de qué archivo y de qué fila salió.
    origen: str | None = None
    archivo_origen: str | None = None
    fila_origen: int | None = None
    anio: int | None = None
    mes: int | None = None

    #: Avisos de la fila (RUC inválido, monto ilegible…). Una fila con avisos se
    #: entrega igual: descartarla en silencio sería peor.
    avisos: list[str] = field(default_factory=list)

    def a_diccionario(self) -> dict[str, Any]:
        datos = asdict(self)
        datos["monto"] = str(self.monto) if self.monto is not None else None
        datos["fecha"] = self.fecha.isoformat() if self.fecha else None
        return datos

    def completo(self) -> bool:
        """¿Están todos los campos obligatorios?"""
        return all(getattr(self, campo) is not None for campo in CAMPOS_OBLIGATORIOS)


@dataclass
class ResultadoEjecucion:
    """Resumen de una corrida, para el informe final y las notificaciones."""

    iniciado_en: datetime
    terminado_en: datetime | None = None
    libros: list[LibroDescargado] = field(default_factory=list)
    ordenes: list[OrdenNormalizada] = field(default_factory=list)
    errores: list[str] = field(default_factory=list)
    advertencias: list[str] = field(default_factory=list)

    def resumen(self) -> dict[str, Any]:
        return {
            "iniciado_en": self.iniciado_en.isoformat(),
            "terminado_en": self.terminado_en.isoformat() if self.terminado_en else None,
            "libros_descargados": len(self.libros),
            "ordenes_normalizadas": len(self.ordenes),
            "ordenes_completas": sum(1 for orden in self.ordenes if orden.completo()),
            "errores": len(self.errores),
            "advertencias": len(self.advertencias),
        }
