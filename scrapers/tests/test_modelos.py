"""Pruebas de los modelos y del resumen.

El resumen es lo que se lee al terminar una corrida, así que sus cifras tienen que ser
honestas: `ordenes_completas` exige todos los campos, y hay fuentes que no publican
alguno. La cobertura por campo es lo que evita que eso parezca un fallo.
"""

from __future__ import annotations

import unittest
from datetime import date, datetime
from decimal import Decimal

from ocos.modelos import CAMPOS_OBLIGATORIOS, OrdenNormalizada, ResultadoEjecucion


def orden(**cambios: object) -> OrdenNormalizada:
    """Una orden completa, con lo que se quiera cambiar."""
    base = {
        "ruc_entidad": "20146657142",
        "entidad": "Municipalidad X",
        "ruc_proveedor": "20131312955",
        "proveedor": "PROVEEDOR UNO S.A.C.",
        "monto": Decimal("100.00"),
        "moneda": "PEN",
        "fecha": date(2023, 6, 15),
        "objeto": "Compra de útiles",
        "estado": "Atendida",
    }
    base.update(cambios)
    return OrdenNormalizada(**base)  # type: ignore[arg-type]


class PruebasDeOrden(unittest.TestCase):
    def test_una_orden_con_todos_los_campos_esta_completa(self) -> None:
        self.assertTrue(orden().completo())

    def test_basta_que_falte_uno_para_no_estarlo(self) -> None:
        self.assertFalse(orden(estado=None).completo())
        self.assertFalse(orden(monto=None).completo())
        self.assertFalse(orden(fecha=None).completo())

    def test_el_diccionario_pasa_los_decimales_y_fechas_a_texto(self) -> None:
        datos = orden().a_diccionario()

        self.assertEqual(datos["monto"], "100.00")
        self.assertEqual(datos["fecha"], "2023-06-15")
        self.assertIsNone(orden(monto=None).a_diccionario()["monto"])


class PruebasDelResumen(unittest.TestCase):
    def test_cuenta_las_ordenes_completas(self) -> None:
        resultado = ResultadoEjecucion(iniciado_en=datetime(2026, 10, 6, 9, 0))
        resultado.ordenes = [orden(), orden(), orden(estado=None)]

        resumen = resultado.resumen()

        self.assertEqual(resumen["ordenes_normalizadas"], 3)
        self.assertEqual(resumen["ordenes_completas"], 2)

    def test_la_cobertura_dice_qué_campo_falta(self) -> None:
        # Es el caso de los conjuntos de datos abiertos: no publican el estado.
        resultado = ResultadoEjecucion(iniciado_en=datetime(2026, 10, 6, 9, 0))
        resultado.ordenes = [orden(estado=None), orden(estado=None), orden(), orden()]

        cobertura = resultado.cobertura_por_campo()

        self.assertEqual(cobertura["estado"], 50.0)
        self.assertEqual(cobertura["monto"], 100.0)
        self.assertEqual(cobertura["moneda"], 100.0)

    def test_la_cobertura_cubre_todos_los_campos_obligatorios(self) -> None:
        resultado = ResultadoEjecucion(iniciado_en=datetime(2026, 10, 6, 9, 0))
        resultado.ordenes = [orden()]

        self.assertEqual(sorted(resultado.cobertura_por_campo()), sorted(CAMPOS_OBLIGATORIOS))

    def test_sin_ordenes_no_se_divide_por_cero(self) -> None:
        resultado = ResultadoEjecucion(iniciado_en=datetime(2026, 10, 6, 9, 0))

        cobertura = resultado.cobertura_por_campo()

        self.assertEqual(set(cobertura.values()), {0.0})
        self.assertEqual(resultado.resumen()["ordenes_normalizadas"], 0)


if __name__ == "__main__":
    unittest.main()
