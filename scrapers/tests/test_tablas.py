"""Pruebas de la lectura de tablas HTML (el caso de SEACE).

SEACE no se pudo inspeccionar (responde 403 a un cliente que no sea navegador), así que
el HTML de prueba imita la forma que tienen las tablas de JSF: una tabla de maquetación
que envuelve a la de resultados. Lo que se comprueba es que el lector **elige la tabla
correcta** y que, cuando no hay ninguna que encaje, lo dice en vez de devolver una lista
vacía.
"""

from __future__ import annotations

import unittest

from ocos.errores import ErrorDeExtraccion
from ocos.tablas import (
    COLUMNAS_SEACE,
    elegir_tabla,
    extraer_tablas,
    leer_resultados,
    normalizar_encabezado,
)

HTML_CON_RESULTADOS = """<html><body>
<table id="formulario"><tr><td>
  <table id="listaResultados" class="tabla">
    <thead>
      <tr><th>Nro Orden</th><th>Fecha</th><th>RUC Proveedor</th><th>Proveedor</th><th>Objeto</th><th>Monto</th><th>Moneda</th><th>Estado</th></tr>
    </thead>
    <tbody>
      <tr><td>OC-0001</td><td>15/06/2023</td><td>20131312955</td><td>PROVEEDOR UNO S.A.C.</td><td>Compra de utiles</td><td>1,234.56</td><td>S/</td><td>Atendida</td></tr>
      <tr><td>OC-0002</td><td>20/06/2023</td><td>20146657142</td><td>PROVEEDOR DOS E.I.R.L.</td><td>Servicio de limpieza</td><td>500.00</td><td>S/</td><td>Atendida</td></tr>
    </tbody>
  </table>
</td></tr></table>
</body></html>"""

HTML_SIN_RESULTADOS = """<html><body>
<table><tr><td>No hay resultados para el periodo seleccionado</td></tr></table>
</body></html>"""

HTML_CON_CELDAS_MULTILINEA = """<html><body>
<table>
  <tr><th>RUC Proveedor</th><th>Proveedor</th><th>Monto</th></tr>
  <tr><td>20131312955</td><td>EMPRESA<br/>CON SALTO</td><td>10.00</td></tr>
</table>
</body></html>"""


class PruebasDeExtraccion(unittest.TestCase):
    def test_encuentra_las_tablas_anidadas(self) -> None:
        tablas = extraer_tablas(HTML_CON_RESULTADOS)
        # La de fuera y la de dentro.
        self.assertEqual(len(tablas), 2)

    def test_elige_la_tabla_de_resultados(self) -> None:
        tablas = extraer_tablas(HTML_CON_RESULTADOS)
        elegida = elegir_tabla(tablas, [COLUMNAS_SEACE["proveedor"], COLUMNAS_SEACE["monto"]])

        self.assertIsNotNone(elegida)
        assert elegida is not None
        self.assertEqual(len(elegida.cuerpo), 2)
        self.assertIn("Proveedor", elegida.encabezados)

    def test_normaliza_los_encabezados(self) -> None:
        self.assertEqual(normalizar_encabezado("RUC Proveedor"), "ruc proveedor")
        self.assertEqual(normalizar_encabezado("Razón Social"), "razon social")
        self.assertEqual(normalizar_encabezado("Nº Orden"), "n orden")

    def test_junta_las_celdas_con_saltos_de_linea(self) -> None:
        tablas = extraer_tablas(HTML_CON_CELDAS_MULTILINEA)
        self.assertIn("EMPRESA CON SALTO", tablas[0].filas[1][1])


class PruebasDeLecturaDeResultados(unittest.TestCase):
    def test_lee_las_filas_como_diccionarios(self) -> None:
        filas = leer_resultados(
            HTML_CON_RESULTADOS,
            columnas=COLUMNAS_SEACE,
            obligatorias=["proveedor", "monto"],
        )

        self.assertEqual(len(filas), 2)
        self.assertEqual(filas[0]["orden"], "OC-0001")
        self.assertEqual(filas[0]["ruc_proveedor"], "20131312955")
        self.assertEqual(filas[0]["proveedor"], "PROVEEDOR UNO S.A.C.")
        self.assertEqual(filas[0]["monto"], "1,234.56")
        self.assertEqual(filas[1]["fecha"], "20/06/2023")

    def test_falla_si_no_encuentra_la_tabla(self) -> None:
        # Una lista vacía se confundiría con "no hay resultados", que es legítimo.
        with self.assertRaises(ErrorDeExtraccion):
            leer_resultados(
                HTML_SIN_RESULTADOS,
                columnas=COLUMNAS_SEACE,
                obligatorias=["proveedor", "monto"],
            )

    def test_el_error_dice_qué_encabezados_buscaba(self) -> None:
        try:
            leer_resultados(
                HTML_SIN_RESULTADOS,
                columnas=COLUMNAS_SEACE,
                obligatorias=["proveedor", "monto"],
            )
        except ErrorDeExtraccion as error:
            self.assertIn("proveedor", str(error))
            self.assertIn("monto", str(error))
        else:
            self.fail("Debería haber lanzado ErrorDeExtraccion")


if __name__ == "__main__":
    unittest.main()
