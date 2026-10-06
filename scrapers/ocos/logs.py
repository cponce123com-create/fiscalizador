"""Registro de actividad.

Un scraper que corre de madrugada y falla en silencio no sirve. Cada paso deja línea:
qué URL se pidió, cuánto tardó, qué se extrajo y qué falló. Se añade un identificador de
corrida a cada mensaje para poder separar dos ejecuciones solapadas en el mismo archivo
de registro.

No se registran datos personales ni el contenido de los libros: solo metadatos.
"""

from __future__ import annotations

import json
import logging
import sys
from typing import Any

REGISTRO = logging.getLogger("ocos")

#: Campos que se añaden a cada mensaje.
_CAMPOS = ("corrida", "entidad", "periodo", "paso")


class _FormateadorDeLinea(logging.Formatter):
    """Formato de consola: legible y con la clave de cada campo."""

    def format(self, record: logging.LogRecord) -> str:
        base = f"{self.formatTime(record, '%Y-%m-%d %H:%M:%S')} {record.levelname:<8}"
        contexto = " ".join(
            f"{campo}={getattr(record, campo)}"
            for campo in _CAMPOS
            if getattr(record, campo, None)
        )
        mensaje = record.getMessage()
        return f"{base} {f'[{contexto}] ' if contexto else ''}{mensaje}"


class _FormateadorJson(logging.Formatter):
    """Formato de archivo: una línea JSON por evento, para poder procesarlo luego."""

    def format(self, record: logging.LogRecord) -> str:
        evento: dict[str, Any] = {
            "momento": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "nivel": record.levelname,
            "mensaje": record.getMessage(),
        }
        for campo in _CAMPOS:
            valor = getattr(record, campo, None)
            if valor:
                evento[campo] = valor
        if record.exc_info:
            evento["excepcion"] = self.formatException(record.exc_info)
        return json.dumps(evento, ensure_ascii=False)


def configurar(
    nivel: str = "INFO",
    *,
    archivo: str | None = None,
    silencioso: bool = False,
) -> logging.Logger:
    """Prepara el registro. Se puede llamar más de una vez sin duplicar manejadores."""
    REGISTRO.setLevel(getattr(logging, nivel.upper(), logging.INFO))
    REGISTRO.handlers.clear()
    REGISTRO.propagate = False

    if not silencioso:
        consola = logging.StreamHandler(sys.stderr)
        consola.setFormatter(_FormateadorDeLinea())
        REGISTRO.addHandler(consola)

    if archivo:
        manejador = logging.FileHandler(archivo, encoding="utf-8")
        manejador.setFormatter(_FormateadorJson())
        REGISTRO.addHandler(manejador)

    return REGISTRO


def con_contexto(**campos: Any) -> dict[str, Any]:
    """Atajo para `REGISTRO.info(mensaje, extra=con_contexto(...))`."""
    return {"extra": {campo: valor for campo, valor in campos.items() if valor is not None}}
