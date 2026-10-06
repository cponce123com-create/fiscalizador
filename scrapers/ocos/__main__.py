"""Punto de entrada de línea de comandos.

Ejemplos:

    python -m ocos --config config.yaml
    python -m ocos --config config.yaml --entidad "Municipalidad Distrital de San Ramón"
    python -m ocos --config config.yaml --periodo 2023-06 --origen seace
    python -m ocos --config config.yaml --listar          # solo enseña el plan
    python -m ocos --config config.example.json           # JSON, sin PyYAML
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .config import cargar
from .errores import ErrorOCOS, ErrorDeConfiguracion
from .logs import configurar
from .orquestador import Orquestador

#: Códigos de salida, para que un cron pueda distinguirlos.
CODIGO_OK = 0
CODIGO_CON_ERRORES = 1
CODIGO_MAL_USO = 2


def construir_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="ocos",
        description=(
            "Descarga y normaliza las órdenes de compra y de servicio publicadas por el "
            "Portal de Transparencia y por el buscador público de SEACE."
        ),
    )

    parser.add_argument("--config", required=True, help="Ruta del archivo de configuración (.yaml o .json).")
    parser.add_argument("--entidad", help="Procesa solo la entidad con este nombre exacto.")
    parser.add_argument("--periodo", help="Procesa solo este periodo (AAAA-MM).")
    parser.add_argument("--origen", choices=("transparencia", "seace"), help="Procesa solo esta fuente.")
    parser.add_argument("--listar", action="store_true", help="Enseña el plan y no descarga nada.")
    parser.add_argument("--log", help="Archivo donde escribir el registro en formato JSON.")
    parser.add_argument("--silencioso", action="store_true", help="No escribe el registro por consola.")

    return parser


def main(argv: list[str] | None = None) -> int:
    argumentos = construir_parser().parse_args(argv)

    try:
        configuracion = cargar(argumentos.config)
    except ErrorDeConfiguracion as error:
        print(f"Error de configuración: {error}", file=sys.stderr)
        return CODIGO_MAL_USO

    configurar(configuracion.nivel_de_registro, archivo=argumentos.log, silencioso=argumentos.silencioso)

    orquestador = Orquestador(configuracion)
    tareas = orquestador.tareas(solo_entidad=argumentos.entidad, solo_periodo=argumentos.periodo)

    if argumentos.listar:
        print(f"Plan: {len(tareas)} combinación(es) de entidad y periodo")
        for tarea in tareas:
            print(
                f"  - {tarea.entidad.nombre} | {tarea.periodo.etiqueta} | "
                f"{', '.join(tarea.entidad.origenes)}"
            )
        return CODIGO_OK

    if not tareas:
        print(
            "No hay nada que hacer: revisa «--entidad» y «--periodo» contra lo que dice la configuración.",
            file=sys.stderr,
        )
        return CODIGO_MAL_USO

    try:
        resultado = orquestador.ejecutar(
            solo_entidad=argumentos.entidad,
            solo_periodo=argumentos.periodo,
            solo_origen=argumentos.origen,
        )
    except ErrorOCOS as error:
        print(f"La corrida falló: {error}", file=sys.stderr)
        return CODIGO_CON_ERRORES

    resumen = resultado.resumen()
    print()
    print("Resumen")
    print(f"  libros descargados : {resumen['libros_descargados']}")
    print(f"  órdenes extraídas  : {resumen['ordenes_normalizadas']}")
    print(f"  órdenes completas  : {resumen['ordenes_completas']}")
    print(f"  errores            : {resumen['errores']}")
    print(f"  advertencias       : {resumen['advertencias']}")

    for error in resultado.errores:
        print(f"  ! {error}", file=sys.stderr)

    for advertencia in resultado.advertencias:
        print(f"  · {advertencia}")

    return CODIGO_CON_ERRORES if resultado.errores else CODIGO_OK


if __name__ == "__main__":
    sys.exit(main())
