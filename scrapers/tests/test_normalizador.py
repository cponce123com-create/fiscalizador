"""Pruebas del normalizador.

Lo que más importa aquí: que una fila con problemas **no se descarte en silencio**, sino
que llegue con sus avisos.
"""

from __future__ import annotations

import unittest
from datetime import date
from decimal import Decimal

from ocos.normalizador import (
    COLUMNAS,
    es_fila_util,
    mapear_columnas,
    normalizar_encabezado,
    normalizar_fila,
    normalizar_filas,
)

ENCABEZADOS = [
    "Nro Orden",
    "Fecha de Emisión",
    "RUC Proveedor",
    "Razón Social",
    "Objeto",
    "Monto",
    "Moneda",
    "Estado",
]

FILA_BUENA = [
    "OC-0001",
    "15/06/2023",
    "20131312955",
    "PROVEEDOR UNO S.A.C.",
    "Compra de útiles",
    "1,234.56",
    "S/",
    "Atendida",
]

FILA_CON_PROBLEMAS = [
    "OC-0002",
    "fecha ilegible",
    "123",
    "PROVEEDOR DOS",
    "Servicio",
    "no es un monto",
    "US$",
    "Atendida",
]


class PruebasDeColumnas(unittest.TestCase):
    def test_normaliza_los_encabezados(self) -> None:
        self.assertEqual(normalizar_encabezado("Razón Social"), "razon social")
        self.assertEqual(normalizar_encabezado("Nº ORDEN"), "n orden")

    def test_mapea_los_campos_conocidos(self) -> None:
        indices = mapear_columnas(ENCABEZADOS)

        self.assertEqual(indices["orden"], 0)
        self.assertEqual(indices["fecha"], 1)
        self.assertEqual(indices["ruc_proveedor"], 2)
        self.assertEqual(indices["proveedor"], 3)
        self.assertEqual(indices["monto"], 5)

    def test_encuentra_las_columnas_aunque_cambie_el_orden(self) -> None:
        desordenados = ["Monto", "Razón Social", "Fecha"]
        indices = mapear_columnas(desordenados)

        self.assertEqual(indices["monto"], 0)
        self.assertEqual(indices["proveedor"], 1)
        self.assertEqual(indices["fecha"], 2)


class PruebasDeNormalizacionDeFila(unittest.TestCase):
    def test_normaliza_una_fila_completa(self) -> None:
        indices = mapear_columnas(ENCABEZADOS)
        # La entidad no viene en el libro: la aporta quien importa, como hace el
        # orquestador. Sin ella, la fila no puede estar completa.
        orden = normalizar_fila(
            FILA_BUENA,
            indices,
            origen="transparencia",
            entidad_por_defecto="Municipalidad X",
            ruc_entidad_por_defecto="20146657142",
        )

        self.assertEqual(orden.ruc_proveedor, "20131312955")
        self.assertEqual(orden.proveedor, "PROVEEDOR UNO S.A.C.")
        self.assertEqual(orden.monto, Decimal("1234.56"))
        self.assertEqual(orden.moneda, "PEN")
        self.assertEqual(orden.fecha, date(2023, 6, 15))
        self.assertEqual(orden.estado, "Atendida")
        self.assertTrue(orden.completo())
        self.assertEqual(orden.avisos, [])

    def test_avisa_en_vez_de_descartar(self) -> None:
        indices = mapear_columnas(ENCABEZADOS)
        orden = normalizar_fila(FILA_CON_PROBLEMAS, indices, origen="transparencia")

        # La fila se entrega...
        self.assertEqual(orden.proveedor, "PROVEEDOR DOS")
        # ...con lo que no se pudo leer en blanco...
        self.assertIsNone(orden.ruc_proveedor)
        self.assertIsNone(orden.monto)
        self.assertIsNone(orden.fecha)
        # ...y con sus avisos.
        self.assertEqual(len(orden.avisos), 3)
        self.assertTrue(any("RUC" in aviso for aviso in orden.avisos))
        self.assertTrue(any("Monto" in aviso for aviso in orden.avisos))
        self.assertTrue(any("Fecha" in aviso for aviso in orden.avisos))
        self.assertFalse(orden.completo())

    def test_usa_los_valores_por_defecto_de_la_entidad(self) -> None:
        indices = mapear_columnas(ENCABEZADOS)
        orden = normalizar_fila(
            FILA_BUENA,
            indices,
            origen="seace",
            entidad_por_defecto="Municipalidad X",
            ruc_entidad_por_defecto="20146657142",
        )

        self.assertEqual(orden.entidad, "Municipalidad X")
        self.assertEqual(orden.ruc_entidad, "20146657142")

    def test_guarda_la_trazabilidad(self) -> None:
        indices = mapear_columnas(ENCABEZADOS)
        orden = normalizar_fila(
            FILA_BUENA, indices, origen="transparencia", archivo="libro.xls", numero_de_fila=7
        )

        self.assertEqual(orden.origen, "transparencia")
        self.assertEqual(orden.archivo_origen, "libro.xls")
        self.assertEqual(orden.fila_origen, 7)

    def test_la_moneda_se_deduce_del_texto(self) -> None:
        indices = mapear_columnas(ENCABEZADOS)
        fila = list(FILA_BUENA)
        fila[6] = "US$"
        orden = normalizar_fila(fila, indices, origen="transparencia")

        self.assertEqual(orden.moneda, "USD")


class PruebasDeFilasUtiles(unittest.TestCase):
    def test_descarta_las_filas_vacias(self) -> None:
        self.assertFalse(es_fila_util(["", None, "   "]))
        self.assertTrue(es_fila_util(["", None, "algo"]))

    def test_normalizar_filas_se_salta_las_vacias(self) -> None:
        filas = [FILA_BUENA, ["", "", "", "", "", "", "", ""], FILA_CON_PROBLEMAS]
        ordenes = normalizar_filas(filas, ENCABEZADOS, origen="transparencia")

        self.assertEqual(len(ordenes), 2)


class PruebasDeCoberturaDeColumnas(unittest.TestCase):
    def test_estan_los_campos_obligatorios_del_pliego(self) -> None:
        for campo in (
            "ruc_proveedor",
            "proveedor",
            "monto",
            "moneda",
            "fecha",
            "objeto",
            "estado",
            "ruc_entidad",
            "entidad",
        ):
            with self.subTest(campo=campo):
                self.assertIn(campo, COLUMNAS)


if __name__ == "__main__":
    unittest.main()
