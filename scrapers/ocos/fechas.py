"""Lectura de fechas.

Los libros peruanos escriben `dd/mm/aaaa`; los exportados, `aaaa-mm-dd`; y las celdas
de Excel llegan ya convertidas a `datetime`. Se aceptan las tres y se devuelve
`date`, sin hora: una orden de compra se emite un día, no a una hora.
"""

from __future__ import annotations

import re
from datetime import date, datetime

FORMATOS = (
    "%d/%m/%Y",
    "%d-%m-%Y",
    "%Y-%m-%d",
    # Los conjuntos de datos abiertos publican la fecha compacta: 20230126.
    "%Y%m%d",
    "%d/%m/%y",
    "%Y/%m/%d",
    "%d.%m.%Y",
)

MESES = {
    1: "Enero",
    2: "Febrero",
    3: "Marzo",
    4: "Abril",
    5: "Mayo",
    6: "Junio",
    7: "Julio",
    8: "Agosto",
    9: "Setiembre",
    10: "Octubre",
    11: "Noviembre",
    12: "Diciembre",
}


def parsear_fecha(valor: object) -> date | None:
    """Convierte a `date`, o `None` si no se puede leer."""
    if valor is None:
        return None
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor

    texto = str(valor).strip()
    if not texto:
        return None

    # Muchos libros añaden la hora: "31/12/2023 00:00:00".
    texto = re.split(r"\s+", texto)[0]

    for formato in FORMATOS:
        try:
            return datetime.strptime(texto, formato).date()
        except ValueError:
            continue

    return None


def parsear_periodo(anio: int, mes: int) -> tuple[int, int]:
    """Valida un año y un mes. Lanza `ValueError` si no son razonables."""
    if not 2000 <= anio <= 2100:
        raise ValueError(f"Año fuera de rango: {anio}.")
    if not 1 <= mes <= 12:
        raise ValueError(f"Mes fuera de rango: {mes}.")
    return anio, mes


def nombre_de_mes(mes: int) -> str:
    """Nombre del mes tal como lo escribe el portal ("Setiembre", no "Septiembre")."""
    return MESES[mes]
