import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from unittest.mock import patch, AsyncMock

from herramientas import seace_worker as worker


class WorkerTests(unittest.TestCase):
    def test_solo_periodo_y_ruc_no_urls_ni_anios_futuros(self):
        self.assertEqual(worker.validar_datos({'anio': 2015, 'mes': 12, 'ruc': '20146657142'}), (2015, 12, '20146657142'))
        for datos in [[], {'anio': True, 'mes': 1, 'ruc': '20146657142'}, {'anio': 2015, 'mes': 13, 'ruc': '20146657142'}, {'anio': 2100, 'mes': 1, 'ruc': '20146657142'}, {'anio': 2015, 'mes': 1, 'ruc': '123'}, {'url': 'http://localhost'}]:
            with self.assertRaises(ValueError):
                worker.validar_datos(datos)

    def test_auth_y_respuesta_binaria_y_bloqueo_seace(self):
        with patch.dict('os.environ', {'SEACE_WORKER_TOKEN': 't' * 64}), patch.object(worker, 'descargar', new_callable=AsyncMock) as descargar:
            servidor = ThreadingHTTPServer(('127.0.0.1', 0), worker.Servicio)
            hilo = threading.Thread(target=servidor.serve_forever, daemon=True)
            hilo.start()
            url = f'http://127.0.0.1:{servidor.server_port}/mes'
            body = json.dumps({'anio': 2015, 'mes': 1, 'ruc': '20146657142'}).encode()
            headers = {'Authorization': 'Bearer ' + 't' * 64, 'Content-Type': 'application/json'}
            try:
                with self.assertRaises(HTTPError) as error:
                    urlopen(Request(url, data=body), timeout=2)
                self.assertEqual(error.exception.code, 401)
                descargar.assert_not_called()
                descargar.return_value = b'bytes-del-excel'
                with urlopen(Request(url, data=body, headers=headers), timeout=2) as respuesta:
                    self.assertEqual(respuesta.read(), b'bytes-del-excel')
                descargar.assert_awaited_once_with(2015, 1, '20146657142')
                descargar.side_effect = ValueError('HTTP 403')
                with self.assertRaises(HTTPError) as error:
                    urlopen(Request(url, data=body, headers=headers), timeout=2)
                self.assertEqual(error.exception.code, 422)
                self.assertFalse(worker.OCUPADO.locked())
            finally:
                servidor.shutdown(); servidor.server_close(); hilo.join(timeout=2)
