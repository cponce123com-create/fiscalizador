"""Cliente HTTP educado: límite de frecuencia y reintentos.

Dos reglas de convivencia con servidores públicos:

1. **Nunca más de una petición cada `segundos_entre_peticiones`.** El límite se aplica
   aquí, en un único sitio, para que ningún scraper lo olvide.
2. **Reintentar con espera creciente** ante fallos de red o 5xx, pero no ante un 404 o
   un 403: eso no se arregla insistiendo.

`requests` es una dependencia del proyecto, pero se importa de forma perezosa para que
el núcleo (y sus pruebas) siga funcionando sin instalarla.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Any

from .errores import ErrorDeRed
from .logs import REGISTRO, con_contexto
from .reintentos import PoliticaReintentos, con_reintentos


@dataclass
class RespuestaHttp:
    """Lo mínimo que necesitan los scrapers de una respuesta."""

    url: str
    estado: int
    texto: str
    contenido: bytes
    tipo_mime: str | None = None


class ClienteHttp:
    """Cliente con límite de frecuencia global y reintentos."""

    def __init__(
        self,
        *,
        segundos_entre_peticiones: float = 2.0,
        timeout: float = 45.0,
        user_agent: str,
        politica: PoliticaReintentos | None = None,
    ) -> None:
        self.segundos_entre_peticiones = segundos_entre_peticiones
        self.timeout = timeout
        self.user_agent = user_agent
        self.politica = politica or PoliticaReintentos()
        self._ultima_peticion = 0.0
        self._cerrojo = threading.Lock()

    def _sesion(self) -> Any:
        try:
            import requests  # type: ignore[import-untyped]
        except ImportError as error:  # pragma: no cover - depende del entorno
            raise ErrorDeRed(
                "Falta la dependencia «requests». Instálala con `pip install -r requirements.txt`."
            ) from error

        if not hasattr(self, "_sesion_http"):
            sesion = requests.Session()
            sesion.headers.update(
                {
                    "User-Agent": self.user_agent,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "es-PE,es;q=0.9",
                }
            )
            self._sesion_http = sesion

        return self._sesion_http

    def _esperar_turno(self) -> None:
        """Respeta el intervalo mínimo entre peticiones."""
        with self._cerrojo:
            transcurrido = time.monotonic() - self._ultima_peticion
            restante = self.segundos_entre_peticiones - transcurrido
            if restante > 0:
                time.sleep(restante)
            self._ultima_peticion = time.monotonic()

    def _una_vez(self, metodo: str, url: str, **kwargs: Any) -> RespuestaHttp:
        self._esperar_turno()

        try:
            respuesta = self._sesion().request(
                metodo, url, timeout=self.timeout, allow_redirects=True, **kwargs
            )
        except Exception as error:  # requests lanza varias familias distintas
            raise ErrorDeRed(f"Fallo al pedir {url}: {error}") from error

        # 5xx y 429 son pasajeros; 4xx no.
        if respuesta.status_code >= 500 or respuesta.status_code == 429:
            raise ErrorDeRed(f"{url} respondió {respuesta.status_code}.")

        return RespuestaHttp(
            url=str(respuesta.url),
            estado=respuesta.status_code,
            texto=respuesta.text,
            contenido=respuesta.content,
            tipo_mime=respuesta.headers.get("Content-Type"),
        )

    def pedir(self, url: str, **kwargs: Any) -> RespuestaHttp:
        """GET con reintentos."""
        return self._con_reintentos("GET", url, **kwargs)

    def enviar(self, url: str, **kwargs: Any) -> RespuestaHttp:
        """POST con reintentos."""
        return self._con_reintentos("POST", url, **kwargs)

    def _con_reintentos(self, metodo: str, url: str, **kwargs: Any) -> RespuestaHttp:
        def intento() -> RespuestaHttp:
            return self._una_vez(metodo, url, **kwargs)

        return con_reintentos(
            intento,
            self.politica,
            al_reintentar=lambda numero, error, espera: REGISTRO.warning(
                f"Reintento {numero} de {url} en {espera:.1f} s: {error}",
                extra=con_contexto(paso="http"),
            ),
        )

    def descargar(self, url: str, **kwargs: Any) -> RespuestaHttp:
        """Descarga un archivo (sin decodificar el cuerpo como texto)."""
        return self.pedir(url, **kwargs)
