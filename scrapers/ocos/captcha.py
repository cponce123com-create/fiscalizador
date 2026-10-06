"""Resolución del captcha de SEACE.

SEACE pide un captcha tipo *gimpy* antes de mostrar resultados. Se resuelve con
`gimpysolver`, que está entrenado específicamente para ese tipo (4000 imágenes, 92 % de
acierto según su autor) y es lo que usa el ecosistema alrededor del portal.

Diseño:

* `ResolvedorDeCaptcha` es una interfaz. Hay tres implementaciones: `gimpysolver`,
  `manual` y `ninguno`. Cambiar de una a otra es cambiar una línea de la configuración.
* **Cuando falla, se guarda la imagen** en `captcha.directorio_de_respaldo`. Sin eso no
  hay forma de saber si el fallo es del modelo o del servidor.
* El resolvedor **no** descarga la imagen: se la dan ya en bytes. Así este módulo no
  depende de Playwright ni de red, y se puede probar con imágenes sintéticas.

Aviso de uso: resolver automáticamente un captcha es sortear una medida técnica del
sitio. Los datos son públicos y la finalidad es de transparencia, pero conviene revisar
las condiciones de uso de SEACE y preferir, cuando exista, la vía de datos abiertos.
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from .errores import ErrorDeCaptcha
from .logs import REGISTRO, con_contexto

#: Tamaño que espera el modelo de `gimpysolver` (ancho, alto).
TAMANO_ESPERADO = (380, 85)


class ResolvedorDeCaptcha(Protocol):
    """Contrato mínimo de un resolvedor."""

    nombre: str

    def resolver(self, imagen: bytes) -> str | None:
        """Devuelve el texto del captcha, o `None` si no pudo."""


def _normalizar(imagen: bytes) -> bytes:
    """Deja la imagen en el tamaño y el formato que espera el modelo.

    `gimpysolver` solo lee PNG de 380x85. Si la imagen viene en otro tamaño se reescala;
    si viene en JPEG se convierte. Todo esto necesita Pillow, que ya es dependencia de
    `gimpysolver`, así que no añade nada nuevo.
    """
    try:
        from PIL import Image  # type: ignore[import-not-found]
    except ImportError:  # pragma: no cover - depende del entorno
        return imagen

    with Image.open(io.BytesIO(imagen)) as original:
        if original.size == TAMANO_ESPERADO and original.format == "PNG":
            return imagen

        ajustada = original.convert("RGB").resize(TAMANO_ESPERADO)
        salida = io.BytesIO()
        ajustada.save(salida, format="PNG")
        return salida.getvalue()


@dataclass
class ResolvedorGimpysolver:
    """Resolvedor automático, con `gimpysolver`."""

    directorio_de_respaldo: Path
    nombre: str = "gimpysolver"

    def resolver(self, imagen: bytes) -> str | None:
        try:
            from gimpysolver import captchaSolverRPA  # type: ignore[import-not-found]
        except ImportError as error:  # pragma: no cover - depende del entorno
            raise ErrorDeCaptcha(
                "Falta «gimpysolver». Instálalo con `pip install gimpysolver` o cambia "
                "`captcha.resolvedor` a «manual» en la configuración."
            ) from error

        self.directorio_de_respaldo.mkdir(parents=True, exist_ok=True)
        ruta = self.directorio_de_respaldo / "captcha-actual.png"
        ruta.write_bytes(_normalizar(imagen))

        try:
            # API de gimpysolver (v0.0.18): se construye con la ruta de un PNG y se
            # llama a `predict()`. `resize()` es opcional y solo hace falta si la
            # imagen no mide 380x85.
            solucionador = captchaSolverRPA.captcha_solver(str(ruta))
            texto = solucionador.predict()
        except Exception as error:
            # Se conserva la imagen: es la única forma de revisar el fallo después.
            respaldo = self.directorio_de_respaldo / "captcha-fallido.png"
            respaldo.write_bytes(ruta.read_bytes())
            REGISTRO.warning(
                f"gimpysolver falló: {error}. Imagen guardada en {respaldo}",
                extra=con_contexto(paso="captcha"),
            )
            return None

        if not texto:
            respaldo = self.directorio_de_respaldo / "captcha-sin-texto.png"
            respaldo.write_bytes(ruta.read_bytes())
            REGISTRO.warning(
                f"gimpysolver no devolvió texto. Imagen guardada en {respaldo}",
                extra=con_contexto(paso="captcha"),
            )
            return None

        return str(texto).strip()


@dataclass
class ResolvedorManual:
    """Deja el captcha en disco y espera a que una persona lo escriba.

    Es el respaldo cuando el resolvedor automático falla y hay alguien delante. Si no
    hay nadie, es preferible marcar la página como pendiente y seguir con la siguiente
    que quedarse esperando.
    """

    directorio_de_respaldo: Path
    segundos_de_espera: float = 180.0
    nombre: str = "manual"

    def resolver(self, imagen: bytes) -> str | None:
        import time

        self.directorio_de_respaldo.mkdir(parents=True, exist_ok=True)
        ruta = self.directorio_de_respaldo / "captcha-manual.png"
        ruta.write_bytes(imagen)

        print()
        print(f"Se necesita ayuda con un captcha. Imagen: {ruta}")
        print(f"Escribe el texto y pulsa Enter (o espera {self.segundos_de_espera:.0f} s):")

        try:
            from concurrent.futures import ThreadPoolExecutor

            with ThreadPoolExecutor(max_workers=1) as ejecutor:
                futuro = ejecutor.submit(input)
                texto = futuro.result(timeout=self.segundos_de_espera)
        except Exception:
            REGISTRO.warning("Nadie resolvió el captcha a tiempo.", extra=con_contexto(paso="captcha"))
            return None

        return texto.strip() or None


@dataclass
class ResolvedorNulo:
    """No resuelve nada: deja pasar el captcha y que SEACE rechace la consulta.

    Sirve para comprobar el resto del circuito sin pelear con el captcha, y para
    entornos donde la consulta no lo requiere.
    """

    nombre: str = "ninguno"

    def resolver(self, imagen: bytes) -> str | None:
        return None


def crear_resolvedor(
    resolvedor: str,
    *,
    directorio_de_respaldo: str | Path,
    segundos_de_espera: float = 180.0,
) -> ResolvedorDeCaptcha:
    """Construye el resolvedor indicado por la configuración."""
    directorio = Path(directorio_de_respaldo)

    if resolvedor == "gimpysolver":
        return ResolvedorGimpysolver(directorio_de_respaldo=directorio)
    if resolvedor == "manual":
        return ResolvedorManual(
            directorio_de_respaldo=directorio, segundos_de_espera=segundos_de_espera
        )
    if resolvedor == "ninguno":
        return ResolvedorNulo()

    raise ErrorDeCaptcha(
        f"Resolvedor de captcha desconocido: {resolvedor}. Válidos: gimpysolver, manual, ninguno."
    )


def resolver_con_reintentos(
    resolvedor: ResolvedorDeCaptcha,
    obtener_imagen,
    *,
    intentos: int = 3,
) -> str:
    """Pide una imagen nueva y la resuelve, hasta `intentos` veces.

    Se vuelve a pedir la imagen en cada intento a propósito: reutilizar la misma
    resuelta mal solo gasta intentos. `obtener_imagen` es una función que devuelve los
    bytes del captcha **actual** (normalmente, volviendo a cargar la página).
    """
    ultimo_error: Exception | None = None

    for intento in range(1, intentos + 1):
        try:
            imagen = obtener_imagen()
            texto = resolvedor.resolver(imagen)
        except Exception as error:
            ultimo_error = error
            REGISTRO.warning(
                f"Intento {intento}/{intentos} de captcha falló: {error}",
                extra=con_contexto(paso="captcha"),
            )
            continue

        if texto:
            return texto

        REGISTRO.info(
            f"Intento {intento}/{intentos}: el resolvedor no dio texto.",
            extra=con_contexto(paso="captcha"),
        )

    if ultimo_error is not None:
        raise ErrorDeCaptcha(f"No se pudo resolver el captcha: {ultimo_error}") from ultimo_error

    raise ErrorDeCaptcha(f"No se pudo resolver el captcha en {intentos} intentos.")
