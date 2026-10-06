"""Pruebas de la validación de RUC."""

from __future__ import annotations

import unittest

from ocos.ruc import digito_verificador, es_ruc_valido, normalizar_ruc, solo_digitos

#: RUC reales y públicos, usados como referencia.
RUC_DE_LA_MUNICIPALIDAD = "20146657142"  # el que publica el portal en su formulario
RUC_DE_SUNAT = "20131312955"


class PruebasDeRuc(unittest.TestCase):
    def test_acepta_rucs_reales(self) -> None:
        self.assertTrue(es_ruc_valido(RUC_DE_LA_MUNICIPALIDAD))
        self.assertTrue(es_ruc_valido(RUC_DE_SUNAT))

    def test_rechaza_un_digito_de_control_incorrecto(self) -> None:
        # El mismo RUC con el último dígito cambiado.
        self.assertFalse(es_ruc_valido("20146657143"))

    def test_rechaza_longitudes_que_no_son_once(self) -> None:
        self.assertFalse(es_ruc_valido("2014665714"))
        self.assertFalse(es_ruc_valido("201466571421"))
        self.assertFalse(es_ruc_valido(""))

    def test_rechaza_prefijos_que_no_corresponden(self) -> None:
        # El 12 no es un tipo de contribuyente válido.
        self.assertFalse(es_ruc_valido("12146657142"))

    def test_el_digito_de_control_coincide_con_la_formula(self) -> None:
        # 2*5 + 0*4 + 1*3 + 4*2 + 6*7 + 6*6 + 5*5 + 7*4 + 1*3 + 4*2 = 163; 163 % 11 = 9;
        # 11 - 9 = 2.
        self.assertEqual(digito_verificador(RUC_DE_LA_MUNICIPALIDAD), 2)

    def test_digito_verificador_exige_once_digitos(self) -> None:
        with self.assertRaises(ValueError):
            digito_verificador("123")

    def test_ignora_puntos_guiones_y_espacios(self) -> None:
        self.assertEqual(solo_digitos("20-146657142"), RUC_DE_LA_MUNICIPALIDAD)
        self.assertTrue(es_ruc_valido("20.146.657.142"))
        self.assertTrue(es_ruc_valido(" 20146657142 "))

    def test_normalizar_devuelve_none_si_no_es_valido(self) -> None:
        self.assertEqual(normalizar_ruc(RUC_DE_LA_MUNICIPALIDAD), RUC_DE_LA_MUNICIPALIDAD)
        self.assertIsNone(normalizar_ruc("20146657143"))
        self.assertIsNone(normalizar_ruc(""))


if __name__ == "__main__":
    unittest.main()
