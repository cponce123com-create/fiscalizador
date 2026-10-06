"""Errores del scraper.

Todos heredan de `ErrorOCOS` para que el orquestador pueda distinguir "algo previsto
ha fallado" de un fallo de programación: solo los primeros se reintentan y se notifican.
"""

from __future__ import annotations


class ErrorOCOS(Exception):
    """Base de todos los errores previstos del scraper."""


class ErrorDeConfiguracion(ErrorOCOS):
    """La configuración no es válida. No se reintenta: hay que corregirla."""


class ErrorDeRed(ErrorOCOS):
    """Fallo de red o respuesta HTTP inesperada. Se reintenta."""


class ErrorDeCaptcha(ErrorOCOS):
    """No se pudo resolver el captcha. Se reintenta con otro intento."""


class ErrorDeExtraccion(ErrorOCOS):
    """La página no tiene la estructura esperada.

    Es el error que hay que vigilar: significa que la fuente cambió, no que la red
    fallara. Reintentar no suele arreglarlo.
    """


class ErrorDeNormalizacion(ErrorOCOS):
    """Una fila no se pudo convertir al formato común."""


class ErrorDeAlmacenamiento(ErrorOCOS):
    """No se pudo guardar o subir un archivo."""
