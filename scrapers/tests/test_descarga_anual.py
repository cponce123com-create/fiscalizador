import asyncio
import io
from pathlib import Path
import tempfile
import unittest
from zipfile import ZipFile
from herramientas.descargar_excel_anual import descarga_verificada, extension_excel, guardar_descarga, nombre_entidad, url_mes


class DescargaAnualTests(unittest.TestCase):
    def test_doce_meses_anio_ruc(self):
        urls = [url_mes(2015, mes, '20146657142') for mes in range(1, 13)]
        self.assertEqual(len(set(urls)), 12)
        self.assertIn('anio=2015&mes=01&theme=ongei', urls[0])
        self.assertIn('anio=2015&mes=12&theme=ongei', urls[-1])
        for anio, mes, ruc in [(1999, 1, '20146657142'), (2015, 13, '20146657142'), (2015, 1, '../dato')]:
            with self.assertRaises(ValueError):
                url_mes(anio, mes, ruc)

    def test_nombre_windows(self):
        self.assertEqual(nombre_entidad('San Ramón / Municipalidad:*?'), 'San-Ramon-Municipalidad')

    def test_rechaza_html_de_error_y_zip_ajeno(self):
        with tempfile.TemporaryDirectory() as carpeta:
            archivo = Path(carpeta) / 'falso.xls'
            archivo.write_bytes(b'<html>Access denied</html>')
            with self.assertRaises(ValueError):
                extension_excel(archivo)
            with ZipFile(archivo, 'w') as zipfile:
                zipfile.writestr('texto.txt', 'no es Excel')
            with self.assertRaises(ValueError):
                extension_excel(archivo)

    def test_original_checksum_reanudacion_sin_sobrescribir(self):
        original = Path(__file__).resolve().parents[2] / 'docs/reference/Lista-OCOS-2023-06.xls'
        contenido = original.read_bytes()
        class Descarga:
            suggested_filename = 'Lista-OCOS.xls'
            async def save_as(self, destino):
                Path(destino).write_bytes(contenido)
        with tempfile.TemporaryDirectory() as carpeta:
            carpeta = Path(carpeta)
            fila = asyncio.run(guardar_descarga(Descarga(), carpeta, 2015, 12, 'San-Ramon'))
            archivo = carpeta / fila['archivo']
            self.assertEqual(archivo.read_bytes(), contenido)
            self.assertTrue(descarga_verificada(fila, carpeta))
            otra = asyncio.run(guardar_descarga(Descarga(), carpeta, 2015, 12, 'San-Ramon'))
            self.assertNotEqual(fila['archivo'], otra['archivo'])
            archivo.write_bytes(b'archivo roto')
            self.assertFalse(descarga_verificada(fila, carpeta))
            self.assertFalse(descarga_verificada({**fila, 'archivo': '../fuera.xls'}, carpeta))

    def test_xlsx_por_contenido(self):
        datos = io.BytesIO()
        with ZipFile(datos, 'w') as libro:
            libro.writestr('xl/workbook.xml', '<workbook/>')
        with tempfile.TemporaryDirectory() as carpeta:
            archivo = Path(carpeta) / 'descarga'
            archivo.write_bytes(datos.getvalue())
            self.assertEqual(extension_excel(archivo), '.xlsx')


class FlujoNavegadorTests(unittest.IsolatedAsyncioTestCase):
    async def test_click_excel_captura_descarga_y_cierra_pagina(self):
        from types import SimpleNamespace
        from herramientas.descargar_excel_anual import descargar_mes
        contenido = (Path(__file__).resolve().parents[2] / 'docs/reference/Lista-OCOS-2023-06.xls').read_bytes()
        class Descarga:
            suggested_filename = 'Lista-OCOS.xls'
            async def save_as(self, destino):
                Path(destino).write_bytes(contenido)
        class Localizador:
            def __init__(self, pagina, cantidad):
                self.pagina, self.cantidad = pagina, cantidad
            def or_(self, otro):
                return Localizador(self.pagina, self.cantidad + otro.cantidad)
            async def count(self):
                return self.cantidad
            def nth(self, indice):
                return self
            async def is_visible(self):
                return True
            async def click(self, **kwargs):
                self.pagina.callbacks['download'](Descarga())
        class Pagina:
            def __init__(self):
                self.callbacks, self.cerrada = {}, False
            def on(self, evento, funcion):
                self.callbacks[evento] = funcion
            async def goto(self, url, **kwargs):
                self.url = url
                return SimpleNamespace(status=200)
            async def wait_for_timeout(self, duracion):
                pass
            def locator(self, selector):
                return Localizador(self, 0)
            def get_by_role(self, rol, **kwargs):
                return Localizador(self, 1 if rol == 'button' else 0)
            def is_closed(self):
                return self.cerrada
            async def close(self):
                self.cerrada = True
        class Contexto:
            def on(self, evento, funcion):
                self.conectar = funcion
            async def new_page(self):
                self.pagina = Pagina()
                self.conectar(self.pagina)
                return self.pagina
            def remove_listener(self, evento, funcion):
                self.conectar = None
        contexto = Contexto()
        args = SimpleNamespace(anio=2015, ruc='20146657142', selector_excel=None, manual=False)
        with tempfile.TemporaryDirectory() as carpeta:
            resultado = await descargar_mes(contexto, args, 12, Path(carpeta), 'San-Ramon')
            self.assertTrue(descarga_verificada(resultado, Path(carpeta)))
            self.assertIn('mes=12', contexto.pagina.url)
        self.assertTrue(contexto.pagina.cerrada)
        self.assertIsNone(contexto.conectar)
