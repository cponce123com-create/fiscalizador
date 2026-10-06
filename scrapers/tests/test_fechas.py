"""Pruebas de la lectura de fechas y periodos."""

from __future__ import annotations

import unittest
from datetime import date, datetime

from ocos.fechas import nombre_de_mes, parsear_fecha, parsear_periodo


class PruebasDeFechas(unittest.TestCase):
    def test_lee_el_formato_peruano(self) -> None:
        self.assertEqual(parsear_fecha("31/12/2023"), date(2023, 12, 31))
        self.assertEqual(parsear_fecha("01/06/2023"), date(2023, 6, 1))

    def test_lee_el_formato_iso(self) -> None:
        self.assertEqual(parsear_fecha("2023-12-31"), date(2023, 12, 31))

    def test_ignora_la_hora(self) -> None:
        self.assertEqual(parsear_fecha("31/12/2023 00:00:00"), date(2023, 12, 31))

    def test_acepta_los_valores_que_ya_son_fecha(self) -> None:
        self.assertEqual(parsear_fecha(datetime(2023, 6, 15, 10, 30)), date(2023, 6, 15))
        self.assertEqual(parsear_fecha(date(2023, 6, 15)), date(2023, 6, 15))

    def test_devuelve_none_cuando_no_se_puede_leer(self) -> None:
        for valor in (None, "", "   ", "no es una fecha", "32/13/2023", "2023-13-01"):
            with self.subTest(valor=valor):
                self.assertIsNone(parsear_fecha(valor))

    def test_valida_el_periodo(self) -> None:
        self.assertEqual(parsear_periodo(2023, 6), (2023, 6))

        with self.assertRaises(ValueError):
            parsear_periodo(1999, 6)
        with self.assertRaises(ValueError):
            parsear_periodo(2023, 13)
        with self.assertRaises(ValueError):
            parsear_periodo(2023, 0)

    def test_el_nombre_del_mes_es_el_que_usa_el_portal(self) -> None:
        # El portal escribe "Setiembre", no "Septiembre".
        self.assertEqual(nombre_de_mes(9), "Setiembre")
        self.assertEqual(nombre_de_mes(1), "Enero")
        self.assertEqual(nombre_de_mes(12), "Diciembre")


if __name__ == "__main__":
    unittest.main()
