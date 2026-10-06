"""Validación de RUC peruano (módulo 11).

El RUC tiene 11 dígitos: los dos primeros identifican el tipo de contribuyente, los
ocho siguientes son el número y el último es un dígito de control que se calcula con
los pesos `5 4 3 2 7 6 5 4 3 2`.

Validarlo importa: los libros llegan con erratas de tecleo, y un RUC mal formado
contamina los cruces con proveedores. Es mejor marcarlo que propagarlo.
"""

from __future__ import annotations

import re

PESOS = (5, 4, 3, 2, 7, 6, 5, 4, 3, 2)

#: Prefijos válidos según el tipo de contribuyente.
PREFIJOS_VALIDOS = ("10", "15", "16", "17", "20")

#: RUC que usa la propia administración en los formularios públicos del portal.
RUC_DE_EJEMPLO = "20146657142"


def solo_digitos(valor: str) -> str:
    """Quita todo lo que no sea dígito (espacios, guiones, puntos)."""
    return re.sub(r"\D", "", valor or "")


def digito_verificador(ruc: str) -> int:
    """Dígito de control de los diez primeros dígitos del RUC."""
    digitos = solo_digitos(ruc)
    if len(digitos) != 11:
        raise ValueError("El RUC debe tener 11 dígitos.")

    suma = sum(int(digito) * peso for digito, peso in zip(digitos[:10], PESOS))
    resto = suma % 11
    return 11 - resto if resto > 0 else 0


def es_ruc_valido(ruc: str) -> bool:
    """¿Es un RUC peruano bien formado?

    Comprueba longitud, prefijo y dígito de control. No comprueba que exista: eso
    exigiría consultar a SUNAT.
    """
    digitos = solo_digitos(ruc)

    if len(digitos) != 11:
        return False
    if not digitos.startswith(PREFIJOS_VALIDOS):
        return False

    esperado = digito_verificador(digitos)
    # El 10 se representa como 0 y el 11 como 1.
    if esperado == 10:
        esperado = 0
    elif esperado == 11:
        esperado = 1

    return int(digitos[10]) == esperado


def normalizar_ruc(ruc: str) -> str | None:
    """Devuelve el RUC en 11 dígitos, o `None` si no es válido."""
    digitos = solo_digitos(ruc)
    return digitos if es_ruc_valido(digitos) else None
