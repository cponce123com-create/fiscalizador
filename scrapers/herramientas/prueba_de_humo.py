"""Prueba de humo: el circuito completo contra una fuente real.

No es una prueba unitaria (esas viven en `tests/` y no salen a la red). Esto lanza el
scraper de verdad contra la Plataforma Nacional de Datos Abiertos: busca el conjunto,
lee su página, descarga el CSV y lo normaliza, escribiendo las salidas.

Sirve para dos cosas:

* Comprobar de una vez que el cliente HTTP, el parseo del conjunto, la descarga, el lector
  de CSV y el normalizador encajan entre sí.
* Ver con datos reales qué cobertura tiene cada campo, que es lo que dice si el dato sirve.

Uso:

    pip install -r requirements.txt
    python herramientas/prueba_de_humo.py
    python herramientas/prueba_de_humo.py --entidad "Gobierno Regional de Ancash"
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from ocos.almacenamiento import AlmacenLocal  # noqa: E402
from ocos.config import cargar  # noqa: E402
from ocos.http import ClienteHttp  # noqa: E402
from ocos.lectores import leer  # noqa: E402
from ocos.logs import configurar  # noqa: E402
from ocos.normalizador import normalizar_filas  # noqa: E402
from ocos.reintentos import PoliticaReintentos  # noqa: E402

CONJUNTO_POR_DEFECTO = (
    "https://www.datosabiertos.gob.pe/dataset/"
    "ordenes-de-compra-y-servicio-del-gobierno-regional-de-ancash-gore-ancash"
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Prueba de humo contra datos abiertos.")
    parser.add_argument("--config", help="Configuración a usar; si no, se va al conjunto por defecto.")
    parser.add_argument("--entidad", help="Nombre de la entidad de la configuración.")
    parser.add_argument("--dataset", default=CONJUNTO_POR_DEFECTO, help="URL del conjunto.")
    argumentos = parser.parse_args()

    configurar("INFO")

    from ocos.datosabiertos import ScraperDatosAbiertos

    cliente = ClienteHttp(
        segundos_entre_peticiones=2.0,
        timeout=60.0,
        user_agent="Mozilla/5.0 (compatible; portal-transparencia/0.1)",
        politica=PoliticaReintentos(intentos=3, espera_inicial=5.0),
    )
    almacen = AlmacenLocal(RAIZ / "salida")
    scraper = ScraperDatosAbiertos(cliente, almacen)

    entidad = "Entidad de prueba"
    ruc = None
    dataset = argumentos.dataset

    if argumentos.config:
        configuracion = cargar(argumentos.config)
        candidatas = [
            e
            for e in configuracion.entidades
            if e.dataset_url and (not argumentos.entidad or e.nombre == argumentos.entidad)
        ]
        if not candidatas:
            print("No hay ninguna entidad con `dataset_url` en la configuración.", file=sys.stderr)
            return 2

        elegida = candidatas[0]
        entidad, ruc, dataset = elegida.nombre, elegida.ruc, elegida.dataset_url or dataset

    print("Conjunto:", dataset)
    conjunto = scraper.inspeccionar(dataset)
    print("Título  :", conjunto.titulo)
    print("Datos   :", [r.nombre for r in conjunto.recursos_de_datos])
    print("Anexos  :", [r.nombre for r in conjunto.anexos])
    print()

    total = 0
    for recurso in conjunto.recursos_de_datos:
        libro = scraper.descargar(recurso, entidad=entidad, anio=2023, mes=1, ruc=ruc)
        print(f"Descargado {libro.nombre_archivo}: {libro.tamano_bytes} bytes")
        print(f"  sha256: {(libro.checksum_sha256 or '')[:16]}…")
        print(f"  ruta  : {libro.ruta_local}")

        encabezados, filas = leer(libro.ruta_local or "")
        print(f"  columnas ({len(encabezados)}): {encabezados}")

        ordenes = normalizar_filas(
            filas,
            encabezados,
            origen=libro.origen,
            archivo=libro.nombre_archivo,
            anio=2023,
            mes=1,
            entidad_por_defecto=entidad,
            ruc_entidad_por_defecto=ruc,
        )
        total += len(ordenes)

        print(f"  órdenes normalizadas: {len(ordenes)}")
        print(f"  completas           : {sum(1 for o in ordenes if o.completo())}")

        if ordenes:
            campos = ("ruc_proveedor", "proveedor", "monto", "moneda", "fecha", "objeto", "estado")
            print("  cobertura por campo :")
            for campo in campos:
                informados = sum(1 for o in ordenes if getattr(o, campo) is not None)
                print(f"    {campo:15} {100 * informados / len(ordenes):6.1f} %")

            suma = sum(o.monto for o in ordenes if o.monto is not None)
            print(f"  suma de montos leídos: {suma}")
            print(f"  primera orden        : {ordenes[0].a_diccionario()}")
        print()

    print(f"Total de órdenes normalizadas: {total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
