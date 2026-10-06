"""Lectura de montos.

Los libros del Portal de Transparencia llegan en Excel y en CSV, y el mismo número
aparece escrito de varias formas: `1,234.56`, `1234.56`, `S/ 1 234,56`, `(1,234.56)`
para los negativos o con el símbolo pegado. Aquí se centraliza esa interpretación para
que ningún módulo invente la suya.

Se devuelve `Decimal`, nunca `float`: son importes de dinero y el binario no los
representa de forma exacta.
"""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation

#: Símbolos y códigos de moneda que pueden venir pegados al número.
SIMBOLOS = {
    "S/.": "PEN",
    "S/": "PEN",
    "PEN": "PEN",
    "SOLES": "PEN",
    "US$": "USD",
    "USD": "USD",
    "DOLARES": "USD",
    "DÓLARES": "USD",
    "EUR": "EUR",
    "€": "EUR",
}

MONEDA_POR_DEFECTO = "PEN"


def detectar_moneda(valor: str) -> str:
    """Moneda indicada en el texto. Si no dice nada, soles."""
    if not valor:
        return MONEDA_POR_DEFECTO

    mayusculas = valor.upper()
    for simbolo, moneda in SIMBOLOS.items():
        if simbolo in mayusculas:
            return moneda

    return MONEDA_POR_DEFECTO


def _limpiar_numero(texto: str) -> str | None:
    """Deja el número en la forma que entiende `Decimal`, o `None` si no se puede.

    Reglas, pensadas para importes de dinero:

    * Si aparecen los dos separadores, el **último** es el decimal: `1,234.56` y
      `1.234,56` se leen igual de bien.
    * Si solo aparece uno y le siguen **exactamente tres dígitos** hasta el final, es un
      separador de millares: `1,234` son mil doscientos treinta y cuatro, no 1,234. Un
      importe con tres decimales es muy raro.
    * En cualquier otro caso, el único separador es el decimal.
    """
    ultimo_punto = texto.rfind(".")
    ultima_coma = texto.rfind(",")

    if ultimo_punto >= 0 and ultima_coma >= 0:
        decimal = "." if ultimo_punto > ultima_coma else ","
        millares = "," if decimal == "." else "."
        limpio = texto.replace(millares, "").replace(decimal, ".")
    else:
        unico = "." if ultimo_punto >= 0 else ("," if ultima_coma >= 0 else None)

        if unico is None:
            limpio = texto
        else:
            posicion = texto.rfind(unico)
            if posicion > 0 and len(texto) - posicion - 1 == 3:
                limpio = texto.replace(unico, "")
            else:
                limpio = texto.replace(unico, ".")

    # Si tras limpiar sigue habiendo más de un punto, no es un número.
    return limpio if limpio.count(".") <= 1 else None


def parsear_monto(valor: object) -> Decimal | None:
    """Convierte a `Decimal` lo que traiga la celda.

    Devuelve `None` cuando la celda está vacía o no hay forma razonable de leerla: es
    preferible dejar el monto en blanco (y marcarlo) que convertirlo en 0 en silencio.
    """
    if valor is None:
        return None
    if isinstance(valor, Decimal):
        return valor
    if isinstance(valor, bool):
        return None
    if isinstance(valor, (int, float)):
        return Decimal(str(valor))

    texto = str(valor).strip()
    if not texto or texto in {"-", "--", "N/A", "n/a", "S/D"}:
        return None

    negativo = texto.startswith("(") and texto.endswith(")")
    if negativo:
        texto = texto[1:-1]

    # Se quitan monedas, espacios duros y cualquier letra suelta.
    texto = re.sub(r"[^\d.,]", "", texto.replace("\u00a0", ""))
    if not texto:
        return None

    limpio = _limpiar_numero(texto)
    if limpio is None:
        return None
    texto = limpio

    try:
        numero = Decimal(texto)
    except InvalidOperation:
        return None

    return -numero if negativo else numero
