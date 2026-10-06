"""Pruebas del resolvedor de captcha.

Lo que se prueba aquí es la **lógica** del resolvedor: la cadena de respaldo, los
reintentos con imagen nueva y la factoría. `gimpysolver` no se puede ejecutar en esta
máquina (ni hay navegador para llegar a SEACE), así que se usa un resolvedor de mentira:
lo que se comprueba es qué hace el código con cada respuesta —incluido un fallo—, no si el
modelo acierta.

El recorte y la conversión a PNG sí se prueban de verdad, pero solo si Pillow está
instalado: sin él, esas pruebas se saltan.
"""

from __future__ import annotations

import io
import unittest

from ocos.captcha import (
    TAMANO_ESPERADO,
    ResolvedorConRespaldo,
    ResolvedorNulo,
    crear_resolvedor,
    resolver_con_reintentos,
)
from ocos.errores import ErrorDeCaptcha

try:
    from PIL import Image  # type: ignore[import-not-found]

    HAY_PIL = True
except ImportError:  # pragma: no cover - depende del entorno
    HAY_PIL = False


class ResolvedorDeMentira:
    """Devuelve lo que se le diga, y apunta cuántas veces se le llamó."""

    def __init__(self, nombre: str, respuestas: list[str | None | Exception]) -> None:
        self.nombre = nombre
        self.respuestas = respuestas
        self.llamadas = 0
        self.imagenes: list[bytes] = []

    def resolver(self, imagen: bytes) -> str | None:
        self.imagenes.append(imagen)
        indice = min(self.llamadas, len(self.respuestas) - 1)
        self.llamadas += 1
        respuesta = self.respuestas[indice]

        if isinstance(respuesta, Exception):
            raise respuesta
        return respuesta


class PruebasDeLaCadenaDeRespaldo(unittest.TestCase):
    def test_usa_el_principal_cuando_acierta(self) -> None:
        principal = ResolvedorDeMentira('principal', ['ABCD'])
        respaldo = ResolvedorDeMentira('respaldo', ['WXYZ'])
        cadena = ResolvedorConRespaldo(principal=principal, respaldo=respaldo)

        self.assertEqual(cadena.resolver(b'imagen'), 'ABCD')
        # El respaldo no se toca si el principal acierta.
        self.assertEqual(respaldo.llamadas, 0)

    def test_cae_al_respaldo_cuando_el_principal_no_da_texto(self) -> None:
        principal = ResolvedorDeMentira('principal', [None])
        respaldo = ResolvedorDeMentira('respaldo', ['WXYZ'])
        cadena = ResolvedorConRespaldo(principal=principal, respaldo=respaldo)

        self.assertEqual(cadena.resolver(b'imagen'), 'WXYZ')
        self.assertEqual(respaldo.llamadas, 1)

    def test_cae_al_respaldo_cuando_el_principal_revienta(self) -> None:
        # Un resolvedor que lanza (por ejemplo, porque falta su dependencia) no debe
        # impedir intentarlo con el otro.
        principal = ResolvedorDeMentira('principal', [ErrorDeCaptcha('falta el modelo')])
        respaldo = ResolvedorDeMentira('respaldo', ['WXYZ'])
        cadena = ResolvedorConRespaldo(principal=principal, respaldo=respaldo)

        self.assertEqual(cadena.resolver(b'imagen'), 'WXYZ')

    def test_devuelve_none_si_fallan_los_dos(self) -> None:
        principal = ResolvedorDeMentira('principal', [None])
        respaldo = ResolvedorDeMentira('respaldo', [None])
        cadena = ResolvedorConRespaldo(principal=principal, respaldo=respaldo)

        self.assertIsNone(cadena.resolver(b'imagen'))

    def test_el_nombre_dice_los_dos(self) -> None:
        cadena = ResolvedorConRespaldo(
            principal=ResolvedorDeMentira('gimpysolver', []),
            respaldo=ResolvedorDeMentira('manual', []),
        )

        self.assertEqual(cadena.nombre, 'gimpysolver+manual')


class PruebasDeLaFactoria(unittest.TestCase):
    def test_crea_el_resolvedor_pedido(self) -> None:
        self.assertEqual(crear_resolvedor('ninguno', directorio_de_respaldo='/tmp/x').nombre, 'ninguno')

    def test_sin_respaldo_devuelve_solo_el_principal(self) -> None:
        resolvedor = crear_resolvedor('ninguno', directorio_de_respaldo='/tmp/x')

        self.assertNotIsInstance(resolvedor, ResolvedorConRespaldo)

    def test_con_respaldo_devuelve_la_cadena(self) -> None:
        resolvedor = crear_resolvedor(
            'gimpysolver', directorio_de_respaldo='/tmp/x', respaldo='manual'
        )

        self.assertIsInstance(resolvedor, ResolvedorConRespaldo)
        self.assertEqual(resolvedor.nombre, 'gimpysolver+manual')

    def test_un_respaldo_igual_al_principal_no_monta_cadena(self) -> None:
        resolvedor = crear_resolvedor(
            'ninguno', directorio_de_respaldo='/tmp/x', respaldo='ninguno'
        )

        self.assertNotIsInstance(resolvedor, ResolvedorConRespaldo)

    def test_rechaza_un_resolvedor_desconocido(self) -> None:
        with self.assertRaises(ErrorDeCaptcha):
            crear_resolvedor('magia', directorio_de_respaldo='/tmp/x')

        with self.assertRaises(ErrorDeCaptcha):
            crear_resolvedor('ninguno', directorio_de_respaldo='/tmp/x', respaldo='magia')


class PruebasDelResolvedorNulo(unittest.TestCase):
    def test_no_resuelve_nada(self) -> None:
        self.assertIsNone(ResolvedorNulo().resolver(b'imagen'))


class PruebasDeReintentos(unittest.TestCase):
    def test_acierta_al_primer_intento(self) -> None:
        resolvedor = ResolvedorDeMentira('x', ['ABCD'])
        imagenes = iter([b'img-1', b'img-2'])

        texto = resolver_con_reintentos(resolvedor, lambda: next(imagenes), intentos=3)

        self.assertEqual(texto, 'ABCD')
        self.assertEqual(resolvedor.llamadas, 1)

    def test_reintenta_hasta_acertar(self) -> None:
        resolvedor = ResolvedorDeMentira('x', [None, None, 'ABCD'])
        imagenes = iter([b'img-1', b'img-2', b'img-3'])

        texto = resolver_con_reintentos(resolvedor, lambda: next(imagenes), intentos=3)

        self.assertEqual(texto, 'ABCD')
        self.assertEqual(resolvedor.llamadas, 3)

    def test_pide_una_imagen_nueva_en_cada_intento(self) -> None:
        # Reutilizar la misma imagen solo gastaría intentos con el mismo texto.
        resolvedor = ResolvedorDeMentira('x', [None, 'ABCD'])
        imagenes = iter([b'img-1', b'img-2'])

        resolver_con_reintentos(resolvedor, lambda: next(imagenes), intentos=3)

        self.assertEqual(resolvedor.imagenes, [b'img-1', b'img-2'])

    def test_agota_los_intentos_y_lo_dice(self) -> None:
        resolvedor = ResolvedorDeMentira('x', [None])

        with self.assertRaises(ErrorDeCaptcha) as contexto:
            resolver_con_reintentos(resolvedor, lambda: b'imagen', intentos=2)

        self.assertIn('2 intentos', str(contexto.exception))
        self.assertEqual(resolvedor.llamadas, 2)

    def test_si_el_resolvedor_revienta_siempre_propaga_el_error(self) -> None:
        resolvedor = ResolvedorDeMentira('x', [ErrorDeCaptcha('sin modelo')])

        with self.assertRaises(ErrorDeCaptcha) as contexto:
            resolver_con_reintentos(resolvedor, lambda: b'imagen', intentos=2)

        self.assertIn('sin modelo', str(contexto.exception))


@unittest.skipUnless(HAY_PIL, 'hace falta Pillow para recortar y convertir imágenes')
class PruebasDeNormalizacionDeLaImagen(unittest.TestCase):
    """`gimpysolver` solo lee PNG de 380x85: lo demás hay que convertirlo."""

    def _imagen(self, tamano: tuple[int, int], formato: str) -> bytes:
        salida = io.BytesIO()
        Image.new('RGB', tamano, color=(200, 200, 200)).save(salida, format=formato)
        return salida.getvalue()

    def test_deja_en_el_tamano_que_espera_el_modelo(self) -> None:
        from ocos.captcha import _normalizar

        resultado = _normalizar(self._imagen((120, 40), 'PNG'))

        with Image.open(io.BytesIO(resultado)) as imagen:
            self.assertEqual(imagen.size, TAMANO_ESPERADO)
            self.assertEqual(imagen.format, 'PNG')

    def test_convierte_a_png_lo_que_venga_en_jpeg(self) -> None:
        from ocos.captcha import _normalizar

        resultado = _normalizar(self._imagen(TAMANO_ESPERADO, 'JPEG'))

        with Image.open(io.BytesIO(resultado)) as imagen:
            self.assertEqual(imagen.format, 'PNG')
            self.assertEqual(imagen.size, TAMANO_ESPERADO)

    def test_si_ya_es_png_del_tamano_correcto_no_lo_toca(self) -> None:
        from ocos.captcha import _normalizar

        original = self._imagen(TAMANO_ESPERADO, 'PNG')

        self.assertEqual(_normalizar(original), original)


if __name__ == '__main__':
    unittest.main()
