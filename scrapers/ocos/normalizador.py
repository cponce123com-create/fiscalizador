"""Normalización al formato común.

Convierte filas crudas (de un Excel, de un CSV o de la tabla de SEACE) en
`OrdenNormalizada`. Dos reglas que se aplican siempre:

* **Nada se descarta en silencio.** Una fila con un RUC inválido o un monto ilegible se
  entrega igual, con el campo en blanco y un aviso anotado. Descartarla escondería un
  problema del dato que alguien tiene que poder ver.
* **Se normaliza por encabezado, no por posición.** Los libros de cada entidad cambian
  el orden de las columnas, así que se buscan por nombre.
"""

from __future__ import annotations

import re
from typing import Iterable, Mapping, Sequence

from .fechas import parsear_fecha
from .modelos import OrdenNormalizada
from .montos import detectar_moneda, parsear_monto
from .ruc import es_ruc_valido, normalizar_ruc

#: Nombre interno -> posibles encabezados en los libros.
COLUMNAS: dict[str, list[str]] = {
    # Ojo con «orden» a secas: en los conjuntos de datos abiertos hay columnas como
    # TIPO_ORDEN y ORDEN_RUC que lo contienen, y el número de orden se quedaba con el
    # tipo. Por eso solo se aceptan formas específicas.
    "orden": [
        "nro orden",
        "n orden",
        "numero de orden",
        "numero orden",
        "nro de orden",
        "orden de compra",
        "orden de servicio",
        "orden compra",
        "orden servicio",
    ],
    "fecha": ["fecha", "fecha de emision", "fecha emision", "fecha de orden"],
    "ruc_proveedor": ["ruc proveedor", "ruc del proveedor", "ruc contratista", "ruc"],
    "proveedor": ["proveedor", "razon social", "nombre o razon social", "contratista", "nombre"],
    "objeto": ["objeto", "descripcion", "concepto", "detalle", "objeto de la contratacion"],
    "monto": ["monto", "importe", "monto total", "valor", "monto considerado"],
    "moneda": ["moneda", "tipo de moneda", "moneda origen"],
    "estado": ["estado", "situacion", "estado de la orden"],
    "tipo": ["tipo", "tipo de orden", "tipo de contratacion"],
    "entidad": ["entidad", "nombre de la entidad", "entidad contratante"],
    "ruc_entidad": ["ruc entidad", "ruc de la entidad"],
}


def normalizar_encabezado(texto: object) -> str:
    """Encabezado comparable: sin acentos, sin signos, en minúsculas."""
    if texto is None:
        return ""

    sin_acentos = (
        str(texto)
        .lower()
        .replace("á", "a")
        .replace("é", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ú", "u")
        .replace("ñ", "n")
    )
    return re.sub(r"[^a-z0-9]+", " ", sin_acentos).strip()


def mapear_columnas(encabezados: Sequence[object]) -> dict[str, int]:
    """Índice de cada campo interno dentro de los encabezados del libro.

    Se resuelven primero las coincidencias **exactas** y cada columna se asigna una sola
    vez. Sin eso, el alias «proveedor» encaja dentro de «RUC Proveedor» y el nombre del
    proveedor acaba siendo el RUC.
    """
    normalizados = [normalizar_encabezado(encabezado) for encabezado in encabezados]
    indices: dict[str, int] = {}
    reclamadas: set[int] = set()

    for campo, alias in COLUMNAS.items():
        for indice, encabezado in enumerate(normalizados):
            if indice not in reclamadas and encabezado in alias:
                indices[campo] = indice
                reclamadas.add(indice)
                break

    for campo, alias in COLUMNAS.items():
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


def _texto(valor: object) -> str | None:
    if valor is None:
        return None
    texto = str(valor).strip()
    return texto or None


def normalizar_fila(
    fila: Sequence[object],
    indices: Mapping[str, int],
    *,
    origen: str,
    archivo: str | None = None,
    numero_de_fila: int | None = None,
    anio: int | None = None,
    mes: int | None = None,
    entidad_por_defecto: str | None = None,
    ruc_entidad_por_defecto: str | None = None,
) -> OrdenNormalizada:
    """Convierte una fila cruda en `OrdenNormalizada`."""

    def valor(campo: str) -> object:
        indice = indices.get(campo)
        if indice is None or indice >= len(fila):
            return None
        return fila[indice]

    avisos: list[str] = []

    ruc_proveedor_crudo = _texto(valor("ruc_proveedor"))
    ruc_proveedor: str | None = None
    if ruc_proveedor_crudo:
        ruc_proveedor = normalizar_ruc(ruc_proveedor_crudo)
        if ruc_proveedor is None:
            avisos.append(f"RUC de proveedor inválido: {ruc_proveedor_crudo!r}")
    else:
        avisos.append("Sin RUC de proveedor")

    ruc_entidad_crudo = _texto(valor("ruc_entidad")) or ruc_entidad_por_defecto
    ruc_entidad: str | None = None
    if ruc_entidad_crudo:
        ruc_entidad = normalizar_ruc(ruc_entidad_crudo)
        if ruc_entidad is None:
            avisos.append(f"RUC de entidad inválido: {ruc_entidad_crudo!r}")

    monto_crudo = valor("monto")
    monto = parsear_monto(monto_crudo)
    if monto is None:
        avisos.append("Monto ilegible o vacío")

    moneda_cruda = _texto(valor("moneda"))
    moneda = detectar_moneda(moneda_cruda or "") if moneda_cruda else "PEN"

    fecha = parsear_fecha(valor("fecha"))
    if fecha is None:
        avisos.append("Fecha ilegible o vacía")

    proveedor = _texto(valor("proveedor"))
    if proveedor is None:
        avisos.append("Sin nombre de proveedor")

    objeto = _texto(valor("objeto"))
    estado = _texto(valor("estado"))

    return OrdenNormalizada(
        ruc_entidad=ruc_entidad,
        entidad=_texto(valor("entidad")) or entidad_por_defecto,
        ruc_proveedor=ruc_proveedor,
        proveedor=proveedor,
        monto=monto,
        moneda=moneda,
        fecha=fecha,
        objeto=objeto,
        estado=estado,
        origen=origen,
        archivo_origen=archivo,
        fila_origen=numero_de_fila,
        anio=anio,
        mes=mes,
        avisos=avisos,
    )


def es_fila_util(fila: Sequence[object]) -> bool:
    """¿La fila tiene algún contenido real?

    Los libros traen filas de totales, de títulos y de cierre. Se descartan aquí, que
    es antes de intentar normalizarlas.
    """
    return any(_texto(celda) for celda in fila)


def normalizar_filas(
    filas: Iterable[Sequence[object]],
    encabezados: Sequence[object],
    **opciones: object,
) -> list[OrdenNormalizada]:
    """Normaliza un bloque de filas con sus encabezados."""
    indices = mapear_columnas(encabezados)
    resultado: list[OrdenNormalizada] = []

    for numero, fila in enumerate(filas, start=1):
        if not es_fila_util(fila):
            continue
        resultado.append(normalizar_fila(fila, indices, numero_de_fila=numero, **opciones))  # type: ignore[arg-type]

    return resultado
