"""Servicio privado de navegador para las descargas del administrador.

No resuelve CAPTCHA ni evade bloqueos de SEACE. Solo acepta año, mes y RUC;
la dirección consultada siempre es la URL oficial, nunca una URL del cliente.
"""
from __future__ import annotations
import asyncio
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import logging
import os
from pathlib import Path
import re
import tempfile
import threading
from datetime import date

from herramientas.descargar_excel_anual import extension_excel, url_mes

MAX_BYTES = 25 * 1024 * 1024
OCUPADO = threading.Lock()


def validar_datos(datos: dict) -> tuple[int, int, str]:
    if not isinstance(datos, dict) or set(datos) != {'anio', 'mes', 'ruc'}:
        raise ValueError('Solicitud inválida.')
    anio, mes, ruc = datos['anio'], datos['mes'], datos['ruc']
    if type(anio) is not int or type(mes) is not int or not isinstance(ruc, str):
        raise ValueError('Solicitud inválida.')
    if anio > date.today().year:
        raise ValueError('Año futuro.')
    url_mes(anio, mes, ruc)
    return anio, mes, ruc


async def descargar(anio: int, mes: int, ruc: str) -> bytes:
    from playwright.async_api import async_playwright
    async with async_playwright() as playwright:
        # Usuario no root y sandbox de Chromium; fallar si el host no lo soporta.
        navegador = await playwright.chromium.launch(headless=True, chromium_sandbox=True)
        contexto = await navegador.new_context(accept_downloads=True)
        cola = asyncio.Queue()
        contexto.on('page', lambda pagina: pagina.on('download', lambda descarga: cola.put_nowait(descarga)))
        try:
            pagina = await contexto.new_page()
            respuesta = await pagina.goto(url_mes(anio, mes, ruc), wait_until='domcontentloaded', timeout=35_000)
            if respuesta is not None and respuesta.status >= 400:
                raise ValueError(f'SEACE respondió HTTP {respuesta.status}.')
            await pagina.wait_for_timeout(1500)
            captcha = pagina.locator('input[name*="captcha" i], input[id*="captcha" i], iframe[src*="recaptcha" i], iframe[src*="hcaptcha" i]')
            if any([await captcha.nth(i).is_visible() for i in range(await captcha.count())]):
                raise ValueError('SEACE requiere intervención manual: CAPTCHA.')
            selector = os.environ.get('SEACE_EXCEL_SELECTOR')
            if selector:
                candidatos = pagina.locator(selector)
            else:
                patron = re.compile(r'excel|\bxlsx?\b', re.I)
                candidatos = pagina.get_by_role('button', name=patron).or_(pagina.get_by_role('link', name=patron))
            visibles = [candidatos.nth(i) for i in range(await candidatos.count()) if await candidatos.nth(i).is_visible()]
            if len(visibles) != 1:
                raise ValueError('No se identificó un único botón Excel. Configura SEACE_EXCEL_SELECTOR tras verificar la página.')
            await visibles[0].click(timeout=10_000)
            descarga = await asyncio.wait_for(cola.get(), timeout=20)
            with tempfile.TemporaryDirectory() as temporal:
                archivo = Path(temporal) / 'libro'
                await descarga.save_as(str(archivo))
                if archivo.stat().st_size > MAX_BYTES:
                    raise ValueError('Libro de más de 25 MB.')
                extension_excel(archivo)
                return archivo.read_bytes()
        finally:
            await contexto.close()
            await navegador.close()


class Servicio(BaseHTTPRequestHandler):
    # No registrar URLs, tokens ni cuerpo de peticiones.
    def log_message(self, formato, *args):
        pass

    def responder(self, status: int, cuerpo: bytes, tipo='application/json'):
        self.send_response(status)
        self.send_header('Content-Type', tipo)
        self.send_header('Content-Length', str(len(cuerpo)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(cuerpo)

    def do_GET(self):
        self.responder(200 if self.path == '/health' else 404, b'{"ok":true}' if self.path == '/health' else b'{}')

    def do_POST(self):
        self.connection.settimeout(10)
        secreto = os.environ.get('SEACE_WORKER_TOKEN', '')
        if len(secreto) < 32 or not hmac.compare_digest(self.headers.get('Authorization', ''), f'Bearer {secreto}'):
            self.responder(401, b'{"error":"No autorizado"}'); return
        if self.path != '/mes':
            self.responder(404, b'{}'); return
        try:
            longitud = int(self.headers.get('Content-Length', '0'))
            if not 0 < longitud <= 2048:
                raise ValueError('Solicitud demasiado grande.')
            datos = validar_datos(json.loads(self.rfile.read(longitud)))
        except (ValueError, TypeError):
            self.responder(400, b'{"error":"Solicitud invalida"}'); return
        if not OCUPADO.acquire(blocking=False):
            self.responder(429, b'{"error":"Ocupado"}'); return
        try:
            contenido = asyncio.run(asyncio.wait_for(descargar(*datos), timeout=85))
            status, tipo = 200, 'application/octet-stream'
        except ValueError as error:
            logging.warning('Descarga no disponible: %s', error)
            status, tipo, contenido = 422, 'application/json', b'{"error":"SEACE requiere revision manual"}'
        except Exception as error:
            logging.error('Fallo del navegador: %s', type(error).__name__)
            status, tipo, contenido = 503, 'application/json', b'{"error":"Servicio de navegador no disponible"}'
        finally:
            OCUPADO.release()
        self.responder(status, contenido, tipo)


def main():
    if len(os.environ.get('SEACE_WORKER_TOKEN', '')) < 32:
        raise SystemExit('SEACE_WORKER_TOKEN debe tener al menos 32 caracteres.')
    ThreadingHTTPServer(('0.0.0.0', int(os.environ.get('PORT', '8080'))), Servicio).serve_forever()


if __name__ == '__main__':
    main()
