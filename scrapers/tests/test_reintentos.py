"""Pruebas de los reintentos con espera exponencial.

Lo importante: que la espera crezca, que respete el tope y que **no** se reintenten los
errores que no tiene sentido reintentar.
"""

from __future__ import annotations

import unittest

from ocos.errores import ErrorDeConfiguracion, ErrorDeRed
from ocos.reintentos import PoliticaReintentos, con_reintentos


class PruebasDeLaPolitica(unittest.TestCase):
    def test_el_primer_intento_no_espera(self) -> None:
        politica = PoliticaReintentos(intentos=3, jitter=0)
        self.assertEqual(politica.espera_del_intento(1), 0.0)

    def test_la_espera_crece_de_forma_exponencial(self) -> None:
        politica = PoliticaReintentos(intentos=4, espera_inicial=5, factor=2, jitter=0)
        self.assertEqual(politica.espera_del_intento(2), 5)
        self.assertEqual(politica.espera_del_intento(3), 10)
        self.assertEqual(politica.espera_del_intento(4), 20)

    def test_la_espera_no_supera_el_tope(self) -> None:
        politica = PoliticaReintentos(intentos=10, espera_inicial=5, factor=10, espera_maxima=30, jitter=0)
        self.assertEqual(politica.espera_del_intento(5), 30)

    def test_el_jitter_no_rompe_el_tope(self) -> None:
        politica = PoliticaReintentos(intentos=5, espera_inicial=10, factor=10, espera_maxima=20, jitter=0.5)
        for intento in range(1, 6):
            self.assertLessEqual(politica.espera_del_intento(intento), 20)

    def test_rechaza_politicas_absurdas(self) -> None:
        with self.assertRaises(ValueError):
            PoliticaReintentos(intentos=0)
        with self.assertRaises(ValueError):
            PoliticaReintentos(factor=0.5)


class PruebasDeLaEjecucion(unittest.TestCase):
    def setUp(self) -> None:
        self.esperas: list[float] = []
        self.politica = PoliticaReintentos(intentos=3, espera_inicial=5, factor=2, jitter=0)

    def dormir(self, segundos: float) -> None:
        # Se apunta lo que se habría dormido, sin dormir de verdad.
        self.esperas.append(segundos)

    def test_devuelve_el_resultado_si_no_falla(self) -> None:
        resultado = con_reintentos(lambda: 42, self.politica, dormir=self.dormir)
        self.assertEqual(resultado, 42)
        self.assertEqual(self.esperas, [])

    def test_reintenta_y_acaba_bien(self) -> None:
        intentos = {"numero": 0}

        def falla_las_dos_primeras() -> str:
            intentos["numero"] += 1
            if intentos["numero"] < 3:
                raise ErrorDeRed("fallo pasajero")
            return "bien"

        resultado = con_reintentos(falla_las_dos_primeras, self.politica, dormir=self.dormir)

        self.assertEqual(resultado, "bien")
        self.assertEqual(intentos["numero"], 3)
        self.assertEqual(self.esperas, [5, 10])

    def test_agota_los_intentos_y_propaga_el_error(self) -> None:
        def siempre_falla() -> None:
            raise ErrorDeRed("siempre igual")

        with self.assertRaises(ErrorDeRed):
            con_reintentos(siempre_falla, self.politica, dormir=self.dormir)

        # Dos esperas para tres intentos.
        self.assertEqual(self.esperas, [5, 10])

    def test_no_reintenta_los_errores_que_no_estan_en_la_lista(self) -> None:
        intentos = {"numero": 0}

        def falla_de_configuracion() -> None:
            intentos["numero"] += 1
            raise ErrorDeConfiguracion("esto no se arregla insistiendo")

        with self.assertRaises(ErrorDeConfiguracion):
            con_reintentos(
                falla_de_configuracion,
                self.politica,
                excepciones=(ErrorDeRed,),
                dormir=self.dormir,
            )

        self.assertEqual(intentos["numero"], 1)
        self.assertEqual(self.esperas, [])

    def test_avisa_de_cada_reintento(self) -> None:
        avisos: list[tuple[int, float]] = []

        def siempre_falla() -> None:
            raise ErrorDeRed("fallo")

        with self.assertRaises(ErrorDeRed):
            con_reintentos(
                siempre_falla,
                self.politica,
                dormir=self.dormir,
                al_reintentar=lambda numero, error, espera: avisos.append((numero, espera)),
            )

        self.assertEqual(avisos, [(1, 5), (2, 10)])


if __name__ == "__main__":
    unittest.main()
