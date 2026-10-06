"""Pruebas de la configuración.

Se prueba sobre diccionarios y sobre un JSON temporal, no sobre YAML: así la validación
se comprueba sin necesitar PyYAML instalado, que es justo el motivo de que el formato
JSON sea el que no exige dependencias.
"""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from ocos.config import cargar, desde_diccionario
from ocos.errores import ErrorDeConfiguracion

MINIMA = {
    "entidades": [
        {
            "nombre": "Municipalidad Distrital de San Ramon",
            "ruc": "20146657142",
            "id_transparencia": "11129",
            "periodos": ["2023-06", "2023-07"],
        }
    ]
}


def con_cambios(base: dict, cambios: dict) -> dict:
    copia = json.loads(json.dumps(base))
    copia.update(cambios)
    return copia


class PruebasDeValidacion(unittest.TestCase):
    def test_acepta_una_configuracion_minima(self) -> None:
        configuracion = desde_diccionario(MINIMA)

        self.assertEqual(len(configuracion.entidades), 1)
        entidad = configuracion.entidades[0]
        self.assertEqual(entidad.nombre, "Municipalidad Distrital de San Ramon")
        self.assertEqual(entidad.ruc, "20146657142")
        self.assertEqual([periodo.etiqueta for periodo in entidad.periodos], ["2023-06", "2023-07"])

    def test_aplica_los_valores_por_defecto(self) -> None:
        configuracion = desde_diccionario(MINIMA)

        # El pliego pide respetar los servidores: el límite por defecto no es 0.
        self.assertEqual(configuracion.red.segundos_entre_peticiones, 2.0)
        self.assertEqual(configuracion.red.reintentos, 3)
        self.assertEqual(configuracion.red.concurrencia, 1)
        self.assertEqual(configuracion.captcha.resolvedor, "gimpysolver")
        self.assertEqual(configuracion.almacenamiento.driver, "local")

    def test_exige_entidades(self) -> None:
        with self.assertRaises(ErrorDeConfiguracion):
            desde_diccionario({})
        with self.assertRaises(ErrorDeConfiguracion):
            desde_diccionario({"entidades": []})

    def test_exige_el_nombre_de_la_entidad(self) -> None:
        datos = {"entidades": [{"periodos": ["2023-06"]}]}

        with self.assertRaises(ErrorDeConfiguracion) as contexto:
            desde_diccionario(datos)
        self.assertIn("nombre", str(contexto.exception))

    def test_exige_el_ruc_para_seace(self) -> None:
        datos = {"entidades": [{"nombre": "X", "origenes": ["seace"], "periodos": ["2023-06"]}]}

        with self.assertRaises(ErrorDeConfiguracion) as contexto:
            desde_diccionario(datos)
        self.assertIn("ruc", str(contexto.exception))

    def test_exige_identificador_para_transparencia(self) -> None:
        datos = {
            "entidades": [
                {"nombre": "X", "origenes": ["transparencia"], "periodos": ["2023-06"]}
            ]
        }

        with self.assertRaises(ErrorDeConfiguracion) as contexto:
            desde_diccionario(datos)
        self.assertIn("id_transparencia", str(contexto.exception))

    def test_rechaza_origenes_desconocidos(self) -> None:
        datos = {"entidades": [{"nombre": "X", "origenes": ["otro"], "periodos": ["2023-06"]}]}

        with self.assertRaises(ErrorDeConfiguracion):
            desde_diccionario(datos)

    def test_rechaza_periodos_mal_escritos(self) -> None:
        for periodo in ("2023", "2023-13", "junio", "2023-6-1"):
            with self.subTest(periodo=periodo):
                datos = {
                    "entidades": [{"nombre": "X", "ruc": "20146657142", "periodos": [periodo]}]
                }
                with self.assertRaises(ErrorDeConfiguracion):
                    desde_diccionario(datos)

    def test_acepta_periodos_como_objeto(self) -> None:
        datos = {
            "entidades": [
                {"nombre": "X", "ruc": "20146657142", "periodos": [{"anio": 2023, "mes": 6}]}
            ]
        }

        configuracion = desde_diccionario(datos)
        self.assertEqual(configuracion.entidades[0].periodos[0].etiqueta, "2023-06")

    def test_impide_bajar_del_limite_de_frecuencia(self) -> None:
        datos = con_cambios(MINIMA, {"red": {"segundos_entre_peticiones": 0.1}})

        with self.assertRaises(ErrorDeConfiguracion) as contexto:
            desde_diccionario(datos)
        self.assertIn("segundos_entre_peticiones", str(contexto.exception))

    def test_rechaza_resolvedores_de_captcha_desconocidos(self) -> None:
        datos = con_cambios(MINIMA, {"captcha": {"resolvedor": "magia"}})

        with self.assertRaises(ErrorDeConfiguracion):
            desde_diccionario(datos)

    def test_rechaza_drivers_de_almacenamiento_desconocidos(self) -> None:
        datos = con_cambios(MINIMA, {"almacenamiento": {"driver": "disquete"}})

        with self.assertRaises(ErrorDeConfiguracion):
            desde_diccionario(datos)


class PruebasDeCargaDeArchivo(unittest.TestCase):
    def test_carga_un_json(self) -> None:
        with tempfile.TemporaryDirectory() as carpeta:
            ruta = Path(carpeta) / "config.json"
            ruta.write_text(json.dumps(MINIMA), encoding="utf-8")

            configuracion = cargar(ruta)

        self.assertEqual(configuracion.entidades[0].id_transparencia, "11129")

    def test_avisa_si_el_archivo_no_existe(self) -> None:
        with self.assertRaises(ErrorDeConfiguracion) as contexto:
            cargar("/tmp/no-existe-este-archivo.json")
        self.assertIn("no existe", str(contexto.exception).lower())

    def test_avisa_si_el_json_esta_mal(self) -> None:
        with tempfile.TemporaryDirectory() as carpeta:
            ruta = Path(carpeta) / "config.json"
            ruta.write_text("{ esto no es json }", encoding="utf-8")

            with self.assertRaises(ErrorDeConfiguracion):
                cargar(ruta)


if __name__ == "__main__":
    unittest.main()
