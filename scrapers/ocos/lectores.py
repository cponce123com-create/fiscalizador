"""Lectura de los archivos descargados.

Se separa del normalizador a propósito: aquí solo se convierte "un archivo" en
"encabezados y filas"; interpretar esas filas es cosa del normalizador.

Formatos:

* `.xls` (el que publica el portal) → `xlrd`.
* `.xlsx` → `openpyxl`.
* `.csv` → biblioteca estándar.
* `.pdf` → `pdfplumber`, y **solo si está instalado**: la extracción de tablas de un PDF
  es aproximada y se marca como tal.

Todas las funciones de este módulo devuelven `(encabezados, filas)`, con las celdas tal
como vienen. Nada se convierte aquí.
"""

from __future__ import annotations

import csv
import io
import re
from pathlib import Path
from typing import Any

from .errores import ErrorDeExtraccion

#: Máximo de filas que se inspeccionan buscando la cabecera.
FILAS_A_EXPLORAR = 30

#: Palabras que suelen aparecer en la fila de encabezados de estos libros.
PISTAS_DE_ENCABEZADO = (
    "ruc",
    "proveedor",
    "razon social",
    "monto",
    "importe",
    "fecha",
    "orden",
    "objeto",
    "descripcion",
)


def _sin_acentos(texto: object) -> str:
    return (
        str(texto or "")
        .lower()
        .replace("á", "a")
        .replace("é", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ú", "u")
        .replace("ñ", "n")
    )


def parece_encabezado(fila: list[Any]) -> bool:
    """¿Esta fila es la de títulos de columna?

    Los libros del portal empiezan con el escudo, el nombre de la entidad y el periodo
    antes de la tabla. Se busca la fila que menciona varias columnas conocidas.
    """
    texto = " | ".join(_sin_acentos(celda) for celda in fila if celda not in (None, ""))
    if not texto:
        return False

    coincidencias = sum(1 for pista in PISTAS_DE_ENCABEZADO if pista in texto)
    return coincidencias >= 2


def separar_encabezado(filas: list[list[Any]]) -> tuple[list[Any], list[list[Any]]]:
    """Separa la fila de encabezados de las de datos.

    Si no se reconoce ninguna cabecera se usa la primera fila con contenido: es
    preferible intentarlo y que el normalizador avise, a fallar aquí sin explicación.
    """
    for indice, fila in enumerate(filas[:FILAS_A_EXPLORAR]):
        if parece_encabezado(fila):
            return fila, filas[indice + 1 :]

    for indice, fila in enumerate(filas):
        if any(celda not in (None, "") for celda in fila):
            return fila, filas[indice + 1 :]

    return [], []


def leer_csv(ruta: str | Path, *, codificacion: str = "utf-8-sig") -> tuple[list[Any], list[list[Any]]]:
    """Lee un CSV detectando el separador."""
    camino = Path(ruta)
    texto = camino.read_bytes().decode(codificacion, errors="replace")

    muestra = texto[:4096]
    try:
        dialecto = csv.Sniffer().sniff(muestra, delimiters=",;	|")
    except csv.Error:
        dialecto = csv.excel

    filas = [fila for fila in csv.reader(io.StringIO(texto), dialecto)]
    return separar_encabezado(filas)


def leer_xls(ruta: str | Path) -> tuple[list[Any], list[list[Any]]]:
    """Lee un `.xls` clásico (formato BIFF)."""
    try:
        import xlrd  # type: ignore[import-not-found]
    except ImportError as error:  # pragma: no cover - depende del entorno
        raise ErrorDeExtraccion(
            "Para leer .xls hace falta `xlrd` (`pip install xlrd`). Los .xls del portal "
            "usan el formato clásico de Excel, que openpyxl no abre."
        ) from error

    libro = xlrd.open_workbook(str(ruta))
    hoja = libro.sheet_by_index(0)
    filas = [hoja.row_values(indice) for indice in range(hoja.nrows)]
    return separar_encabezado(filas)


def leer_xlsx(ruta: str | Path) -> tuple[list[Any], list[list[Any]]]:
    """Lee un `.xlsx` moderno."""
    try:
        from openpyxl import load_workbook  # type: ignore[import-not-found]
    except ImportError as error:  # pragma: no cover - depende del entorno
        raise ErrorDeExtraccion(
            "Para leer .xlsx hace falta `openpyxl` (`pip install openpyxl`)."
        ) from error

    libro = load_workbook(filename=str(ruta), read_only=True, data_only=True)
    hoja = libro.worksheets[0]
    filas = [list(fila) for fila in hoja.iter_rows(values_only=True)]
    libro.close()
    return separar_encabezado(filas)


def leer_pdf(ruta: str | Path) -> tuple[list[Any], list[list[Any]]]:
    """Intenta extraer la tabla de un PDF.

    Es aproximado: un PDF no guarda celdas, guarda dibujo. Si el portal publica el mismo
    dato en Excel, hay que preferir el Excel.
    """
    try:
        import pdfplumber  # type: ignore[import-not-found]
    except ImportError as error:  # pragma: no cover - depende del entorno
        raise ErrorDeExtraccion(
            "Para leer PDF hace falta `pdfplumber` (`pip install pdfplumber`). "
            "Si el mismo dato existe en Excel, es preferible descargar el Excel."
        ) from error

    filas: list[list[Any]] = []
    with pdfplumber.open(str(ruta)) as pdf:
        for pagina in pdf.pages:
            for tabla in pagina.extract_tables() or []:
                filas.extend(tabla)

    return separar_encabezado(filas)


LECTORES = {
    ".csv": leer_csv,
    ".xls": leer_xls,
    ".xlsx": leer_xlsx,
    ".pdf": leer_pdf,
}


def leer(ruta: str | Path) -> tuple[list[Any], list[list[Any]]]:
    """Lee un archivo según su extensión.

    :raises ErrorDeExtraccion: si la extensión no está soportada.
    """
    camino = Path(ruta)
    extension = camino.suffix.lower()

    lector = LECTORES.get(extension)
    if lector is None:
        raise ErrorDeExtraccion(
            f"Extensión no soportada: {extension or '(sin extensión)'} en {camino.name}. "
            f"Soportadas: {', '.join(sorted(LECTORES))}."
        )

    return lector(camino)


def nombre_seguro(nombre: str) -> str:
    """Nombre de archivo sin rutas ni caracteres problemáticos.

    El nombre lo elige el servidor de origen: si trae `../` o un separador de ruta, no
    puede decidir dónde se escribe el archivo.
    """
    base = Path(nombre.replace(chr(92), '/')).name
    limpio = re.sub(r"[^A-Za-z0-9._\-]+", "_", base).strip("._")
    return limpio or "archivo"
