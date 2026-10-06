"""Pruebas de la lectura de montos."""

from __future__ import annotations

import unittest
from decimal import Decimal

from ocos.montos import detectar_moneda, parsear_monto


class PruebasDeMontos(unittest.TestCase):
    def test_lee_el_formato_habitual_del_portal(self) -> None:
        self.assertEqual(parsear_monto("1,234.56"), Decimal("1234.56"))
        self.assertEqual(parsear_monto("1234.56"), Decimal("1234.56"))
        self.assertEqual(parsear_monto("0.00"), Decimal("0.00"))

    def test_lee_el_formato_con_coma_decimal(self) -> None:
        self.assertEqual(parsear_monto("1.234,56"), Decimal("1234.56"))
        self.assertEqual(parsear_monto("12,5"), Decimal("12.5"))

    def test_separa_millares_sin_decimales(self) -> None:
        self.assertEqual(parsear_monto("1,234"), Decimal("1234"))
        self.assertEqual(parsear_monto("1.234"), Decimal("1234"))

    def test_quita_el_simbolo_de_moneda_y_los_espacios(self) -> None:
        self.assertEqual(parsear_monto("S/ 1,234.56"), Decimal("1234.56"))
        self.assertEqual(parsear_monto("US$ 500.00"), Decimal("500.00"))

    def test_lee_los_negativos_entre_parentesis(self) -> None:
        self.assertEqual(parsear_monto("(1,234.56)"), Decimal("-1234.56"))

    def test_devuelve_none_cuando_no_hay_monto(self) -> None:
        # Nunca 0: un monto ilegible no es un monto de cero.
        for valor in ("", "   ", "-", "N/A", "S/D", None, "sin dato"):
            with self.subTest(valor=valor):
                self.assertIsNone(parsear_monto(valor))

    def test_lee_los_millares_con_punto(self) -> None:
        # En formato europeo, 1.234.567 son un millón doscientos treinta y cuatro
        # mil quinientos sesenta y siete.
        self.assertEqual(parsear_monto("1.234.567"), Decimal("1234567"))

    def test_devuelve_none_con_texto_que_no_es_un_numero(self) -> None:
        self.assertIsNone(parsear_monto("1.2.3"))
        self.assertIsNone(parsear_monto("doce"))

    def test_acepta_los_numeros_que_ya_vienen_convertidos(self) -> None:
        self.assertEqual(parsear_monto(1500), Decimal("1500"))
        self.assertEqual(parsear_monto(1500.5), Decimal("1500.5"))
        self.assertEqual(parsear_monto(Decimal("99.99")), Decimal("99.99"))

    def test_no_confunde_un_booleano_con_un_numero(self) -> None:
        self.assertIsNone(parsear_monto(True))

    def test_detecta_la_moneda(self) -> None:
        self.assertEqual(detectar_moneda("S/ 100"), "PEN")
        self.assertEqual(detectar_moneda("US$ 100"), "USD")
        self.assertEqual(detectar_moneda("100 soles"), "PEN")
        self.assertEqual(detectar_moneda("EUR 100"), "EUR")
        # Sin símbolo se asume soles, que es lo que publica el portal.
        self.assertEqual(detectar_moneda("100"), "PEN")
        self.assertEqual(detectar_moneda(""), "PEN")


if __name__ == "__main__":
    unittest.main()
