"""Pruebas del scraper de datos abiertos.

El HTML de prueba reproduce lo que publica de verdad la Plataforma Nacional de Datos
Abiertos en la página de un conjunto (comprobado con el conjunto de órdenes de compra y
servicio del Gobierno Regional de Áncash): el CSV de datos va acompañado del diccionario
de datos y de los metadatos, y **no todos son datos**.
"""

from __future__ import annotations

import unittest

from ocos.datosabiertos import (
    ConjuntoDeDatos,
    Recurso,
    anios_del_conjunto,
    conjuntos_de_la_busqueda,
    exigir_recursos_de_datos,
    recursos_de_la_pagina,
)
from ocos.errores import ErrorDeExtraccion

PAGINA_DEL_CONJUNTO = """<!doctype html>
<html><head>
<title>Ordenes de compra y servicio del Gobierno Regional de Ancash - [GORE ANCASH] | Plataforma Nacional de Datos Abiertos</title>
</head><body>
<div class="recursos">
  <a href="/sites/default/files/DataSet_OrdenesCompraYServicio1_0.csv">Descargar</a>
  <a href="/sites/default/files/DiccionarioDatos_OrdenesCompraYServicio.xlsx">Descargar</a>
  <a href="/sites/default/files/Metadatos_OrdenesCompraYServicios.docx">Descargar</a>
  <a href="/sites/default/files/leydigital.pdf">Ley de Gobierno Digital</a>
</div>
</body></html>"""

PAGINA_SIN_DATOS = """<!doctype html>
<html><body>
<a href="/sites/default/files/DiccionarioDatos_Ordenes.xlsx">Descargar</a>
<a href="/sites/default/files/Metadatos_Ordenes.docx">Descargar</a>
</body></html>"""

PAGINA_DE_BUSQUEDA = """<!doctype html>
<html><body>
<div class="resultados">
  <a href="/dataset/ordenes-de-compra-y-servicio-del-gobierno-regional-de-ancash-gore-ancash">Ordenes de compra y servicio del Gobierno Regional de Ancash</a>
  <a href="/dataset/ordenes-de-compra-y-servicio-de-la-municipalidad-distrital-de-chaclacayo-2024-mdch">Ordenes de Compra y Servicios de la Municipalidad Distrital de Chaclacayo 2024</a>
  <a href="/dataset/ordenes-de-compra-y-servicio-del-gobierno-regional-de-ancash-gore-ancash">Ordenes de compra y servicio del Gobierno Regional de Ancash</a>
  <a href="/search/type/dataset?page=1">Siguiente</a>
</div>
</body></html>"""


class PruebasDeRecursos(unittest.TestCase):
    def test_lee_los_ficheros_de_la_pagina(self) -> None:
        recursos = recursos_de_la_pagina(PAGINA_DEL_CONJUNTO)

        nombres = [recurso.nombre for recurso in recursos]
        self.assertIn("DataSet_OrdenesCompraYServicio1_0.csv", nombres)
        self.assertIn("DiccionarioDatos_OrdenesCompraYServicio.xlsx", nombres)

    def test_resuelve_las_rutas_relativas(self) -> None:
        recursos = recursos_de_la_pagina(PAGINA_DEL_CONJUNTO)

        for recurso in recursos:
            with self.subTest(url=recurso.url):
                self.assertTrue(recurso.url.startswith("https://www.datosabiertos.gob.pe/"))

    def test_descarta_los_anexos(self) -> None:
        conjunto = ConjuntoDeDatos(url="https://ejemplo.test", recursos=recursos_de_la_pagina(PAGINA_DEL_CONJUNTO))

        nombres = [recurso.nombre for recurso in conjunto.recursos_de_datos]
        # El CSV sí; el diccionario de datos y los metadatos, no.
        self.assertEqual(nombres, ["DataSet_OrdenesCompraYServicio1_0.csv"])
        self.assertEqual(len(conjunto.anexos), 3)

    def test_un_recurso_sin_formato_conocido_no_es_de_datos(self) -> None:
        recurso = Recurso(url="https://ejemplo.test/sites/default/files/pagina.html", formato=".html")

        self.assertFalse(recurso.es_de_datos())


class PruebasDeLaBusqueda(unittest.TestCase):
    def test_encuentra_los_conjuntos(self) -> None:
        conjuntos = conjuntos_de_la_busqueda(PAGINA_DE_BUSQUEDA)

        # Dos enlaces distintos: el tercero repite el primero.
        self.assertEqual(len(conjuntos), 2)
        self.assertTrue(all("/dataset/" in url for url, _ in conjuntos))

    def test_no_cuela_la_paginacion(self) -> None:
        conjuntos = conjuntos_de_la_busqueda(PAGINA_DE_BUSQUEDA)

        self.assertFalse(any("search" in url for url, _ in conjuntos))

    def test_conserva_el_titulo(self) -> None:
        conjuntos = conjuntos_de_la_busqueda(PAGINA_DE_BUSQUEDA)

        self.assertIn("Ancash", conjuntos[0][1])


class PruebasDeInspeccion(unittest.TestCase):
    def test_falla_si_solo_hay_anexos(self) -> None:
        # Caso real: una entidad sube el diccionario de datos pero no los datos. Hay
        # que decirlo, no devolver una lista vacía que parecería "no hay órdenes".
        conjunto = ConjuntoDeDatos(
            url="https://ejemplo.test/dataset/x",
            recursos=recursos_de_la_pagina(PAGINA_SIN_DATOS),
        )

        with self.assertRaises(ErrorDeExtraccion) as contexto:
            exigir_recursos_de_datos(conjunto)

        self.assertIn("no publica ningún archivo de datos", str(contexto.exception))

    def test_devuelve_los_recursos_cuando_los_hay(self) -> None:
        conjunto = ConjuntoDeDatos(
            url="https://ejemplo.test/dataset/x",
            recursos=recursos_de_la_pagina(PAGINA_DEL_CONJUNTO),
        )

        self.assertEqual(len(exigir_recursos_de_datos(conjunto)), 1)
    def test_los_anios_se_sacan_del_nombre(self) -> None:
        recursos = [
            Recurso(url="https://x/Ordenes_2023.csv", formato=".csv"),
            Recurso(url="https://x/Ordenes_2024.csv", formato=".csv"),
            Recurso(url="https://x/Diccionario.xlsx", formato=".xlsx"),
        ]

        self.assertEqual(anios_del_conjunto(recursos), [2023, 2024])


if __name__ == "__main__":
    unittest.main()
