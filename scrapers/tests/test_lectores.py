"""Pruebas de los lectores de archivos y de los nombres de fichero.

Dos partes bien distintas:

* Lo que usa solo la biblioteca estándar (CSV, detección de la fila de encabezados y
  saneado de nombres) se prueba siempre.
* Lo que necesita `openpyxl` o `xlrd` se prueba **solo si están instalados**, con
  `skipUnless`. Así la batería sigue corriendo en un entorno sin dependencias, pero no se
  renuncia a comprobar el lector de Excel donde sí las hay.
"""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from ocos.errores import ErrorDeExtraccion
from ocos.lectores import (
    leer,
    leer_csv,
    nombre_seguro,
    parece_encabezado,
    separar_encabezado,
)

try:
    import openpyxl  # type: ignore[import-not-found]

    HAY_OPENPYXL = True
except ImportError:  # pragma: no cover - depende del entorno
    HAY_OPENPYXL = False


class PruebasDeNombreSeguro(unittest.TestCase):
    """El nombre lo elige el servidor de origen: no puede decidir dónde se escribe."""

    def test_quita_las_rutas(self) -> None:
        self.assertEqual(nombre_seguro("../../etc/passwd"), "passwd")
        self.assertEqual(nombre_seguro("carpeta/subcarpeta/libro.xls"), "libro.xls")

    def test_quita_las_rutas_de_windows(self) -> None:
        # chr(92) es la barra invertida.
        self.assertEqual(nombre_seguro(".." + chr(92) + ".." + chr(92) + "x.xls"), "x.xls")

    def test_sustituye_los_caracteres_raros(self) -> None:
        self.assertEqual(nombre_seguro("  raro  <>.xls"), "raro_.xls")

    def test_conserva_un_nombre_normal(self) -> None:
        self.assertEqual(nombre_seguro("Ordenes_2023-06.xls"), "Ordenes_2023-06.xls")

    def test_nunca_devuelve_vacio(self) -> None:
        self.assertEqual(nombre_seguro(""), "archivo")
        self.assertEqual(nombre_seguro(".."), "archivo")


class PruebasDeDeteccionDeEncabezado(unittest.TestCase):
    def test_reconoce_una_fila_de_titulos(self) -> None:
        self.assertTrue(
            parece_encabezado(["Nro Orden", "RUC Proveedor", "Razon Social", "Monto"])
        )

    def test_no_confunde_una_fila_de_datos(self) -> None:
        self.assertFalse(parece_encabezado(["OC-0001", "20131312955", "PROVEEDOR UNO"]))

    def test_se_salta_las_filas_de_titulo_del_libro(self) -> None:
        filas = [
            ["MUNICIPALIDAD DISTRITAL DE EJEMPLO"],
            ["ORDENES DE BIENES Y SERVICIOS - JUNIO 2023"],
            [],
            ["Nro Orden", "RUC Proveedor", "Monto"],
            ["OC-0001", "20131312955", "100.00"],
        ]

        encabezados, datos = separar_encabezado(filas)

        self.assertEqual(encabezados, ["Nro Orden", "RUC Proveedor", "Monto"])
        self.assertEqual(len(datos), 1)

    def test_si_no_hay_encabezado_usa_la_primera_fila_con_contenido(self) -> None:
        encabezados, datos = separar_encabezado([["a", "b"], ["c", "d"]])

        self.assertEqual(encabezados, ["a", "b"])
        self.assertEqual(datos, [["c", "d"]])

    def test_sin_filas_no_inventa_nada(self) -> None:
        self.assertEqual(separar_encabezado([]), ([], []))


class PruebasDeCsv(unittest.TestCase):
    def test_detecta_el_punto_y_coma(self) -> None:
        with tempfile.TemporaryDirectory() as carpeta:
            ruta = Path(carpeta) / "libro.csv"
            ruta.write_text(
                chr(10).join(
                    [
                        "Nro Orden;RUC Proveedor;Monto",
                        "OC-1;20131312955;1.234,56",
                        "",
                    ]
                ),
                encoding="utf-8",
            )

            encabezados, filas = leer_csv(ruta)

        self.assertEqual(encabezados, ["Nro Orden", "RUC Proveedor", "Monto"])
        self.assertEqual(filas, [["OC-1", "20131312955", "1.234,56"]])

    def test_lee_el_bom_de_utf8(self) -> None:
        with tempfile.TemporaryDirectory() as carpeta:
            ruta = Path(carpeta) / "libro.csv"
            ruta.write_bytes(
                chr(10)
                .join(
                    [
                        "RUC Proveedor,Monto",
                        "20131312955,10.00",
                        "",
                    ]
                )
                .encode("utf-8-sig")
            )

            encabezados, _ = leer_csv(ruta)

        # Sin quitar el BOM, la primera cabecera sería invisiblemente distinta.
        self.assertEqual(encabezados[0], "RUC Proveedor")

    def test_rechaza_una_extension_no_soportada(self) -> None:
        with tempfile.TemporaryDirectory() as carpeta:
            ruta = Path(carpeta) / "libro.txt"
            ruta.write_text("da igual", encoding="utf-8")

            with self.assertRaises(ErrorDeExtraccion) as contexto:
                leer(ruta)

        self.assertIn("Extensión no soportada", str(contexto.exception))


@unittest.skipUnless(HAY_OPENPYXL, "hace falta openpyxl para leer .xlsx")
class PruebasDeXlsx(unittest.TestCase):
    def _libro(self, carpeta: str) -> Path:
        libro = openpyxl.Workbook()
        hoja = libro.active

        # Los libros del portal empiezan con el escudo, el nombre de la entidad y el
        # periodo antes de la tabla.
        hoja.append(["MUNICIPALIDAD DISTRITAL DE EJEMPLO"])
        hoja.append(["ORDENES DE BIENES Y SERVICIOS - JUNIO 2023"])
        hoja.append([])
        hoja.append(["Nro Orden", "Fecha de Emision", "RUC Proveedor", "Monto"])
        hoja.append(["OC-0001", "15/06/2023", "20131312955", 1234.56])
        hoja.append(["OC-0002", "20/06/2023", "20146657142", "1,500.00"])

        ruta = Path(carpeta) / "libro.xlsx"
        libro.save(ruta)
        return ruta

    def test_encuentra_la_cabecera_debajo_de_los_titulos(self) -> None:
        with tempfile.TemporaryDirectory() as carpeta:
            encabezados, filas = leer(self._libro(carpeta))

        self.assertEqual(encabezados, ["Nro Orden", "Fecha de Emision", "RUC Proveedor", "Monto"])
        self.assertEqual(len(filas), 2)

    def test_lee_los_numeros_como_numeros(self) -> None:
        with tempfile.TemporaryDirectory() as carpeta:
            _, filas = leer(self._libro(carpeta))

        # openpyxl devuelve el número tal cual; el normalizador ya lo convierte a Decimal.
        self.assertEqual(filas[0][3], 1234.56)


if __name__ == "__main__":
    unittest.main()
