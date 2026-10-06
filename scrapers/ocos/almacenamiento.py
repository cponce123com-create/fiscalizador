"""Almacenamiento de los archivos descargados y de los resultados.

Tres destinos, con la misma interfaz:

* `local` (por defecto): disco. Es lo que hace falta para que el portal importe el
  libro a mano.
* `s3`: `boto3`, opcional.
* `cloudinary`: `cloudinary`, opcional.

El checksum SHA-256 se calcula **siempre**, incluso en local. Es lo que permite saber
que dos descargas son el mismo libro sin comparar los archivos byte a byte, y es la
misma idea que usa el portal con `ImportBatch.checksum`.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path

from .errores import ErrorDeAlmacenamiento
from .logs import REGISTRO, con_contexto


def checksum(datos: bytes) -> str:
    """SHA-256 en hexadecimal."""
    return hashlib.sha256(datos).hexdigest()


@dataclass
class ArchivoGuardado:
    """Resultado de guardar un archivo."""

    ruta_local: Path | None
    checksum_sha256: str
    tamano_bytes: int
    url_remota: str | None = None


class AlmacenLocal:
    """Guarda en disco, con una carpeta por origen y periodo."""

    def __init__(self, directorio_base: str | Path) -> None:
        self.directorio_base = Path(directorio_base)

    def ruta_para(self, *, origen: str, entidad: str, anio: int, mes: int, nombre: str) -> Path:
        # La entidad va en la ruta, así que se limpia: viene de la configuración, pero
        # no debe poder salirse del directorio base.
        carpeta = self.directorio_base / origen / _segmento(entidad) / f"{anio}" / f"{mes:02d}"
        carpeta.mkdir(parents=True, exist_ok=True)
        return carpeta / _segmento(nombre)

    def guardar(
        self,
        datos: bytes,
        *,
        origen: str,
        entidad: str,
        anio: int,
        mes: int,
        nombre: str,
    ) -> ArchivoGuardado:
        destino = self.ruta_para(origen=origen, entidad=entidad, anio=anio, mes=mes, nombre=nombre)

        try:
            destino.write_bytes(datos)
        except OSError as error:
            raise ErrorDeAlmacenamiento(f"No se pudo escribir {destino}: {error}") from error

        REGISTRO.debug(
            f"Guardado {destino} ({len(datos)} bytes)",
            extra=con_contexto(paso="almacenamiento"),
        )

        return ArchivoGuardado(
            ruta_local=destino,
            checksum_sha256=checksum(datos),
            tamano_bytes=len(datos),
        )


class AlmacenS3:
    """Sube a S3, conservando una copia local."""

    def __init__(self, bucket: str, prefijo: str = "", local: AlmacenLocal | None = None) -> None:
        self.bucket = bucket
        self.prefijo = prefijo.strip("/")
        self.local = local

    def guardar(
        self,
        datos: bytes,
        *,
        origen: str,
        entidad: str,
        anio: int,
        mes: int,
        nombre: str,
    ) -> ArchivoGuardado:
        try:
            import boto3  # type: ignore[import-not-found]
        except ImportError as error:  # pragma: no cover - depende del entorno
            raise ErrorDeAlmacenamiento(
                "Para subir a S3 hace falta `boto3` (`pip install boto3`)."
            ) from error

        guardado = (
            self.local.guardar(
                datos, origen=origen, entidad=entidad, anio=anio, mes=mes, nombre=nombre
            )
            if self.local
            else ArchivoGuardado(ruta_local=None, checksum_sha256=checksum(datos), tamano_bytes=len(datos))
        )

        clave = "/".join(
            parte
            for parte in (self.prefijo, origen, _segmento(entidad), f"{anio}", f"{mes:02d}", _segmento(nombre))
            if parte
        )

        try:
            boto3.client("s3").put_object(Bucket=self.bucket, Key=clave, Body=datos)
        except Exception as error:
            raise ErrorDeAlmacenamiento(f"No se pudo subir {clave} a S3: {error}") from error

        guardado.url_remota = f"s3://{self.bucket}/{clave}"
        return guardado


def _segmento(texto: str) -> str:
    """Trozo de ruta seguro: sin separadores ni `..`."""
    limpio = "".join(caracter if caracter.isalnum() or caracter in "-_." else "_" for caracter in texto)
    limpio = limpio.strip("._")
    return limpio[:120] or "sin_nombre"


def crear_almacenamiento(
    driver: str,
    *,
    directorio_base: str | Path,
    bucket: str | None = None,
    prefijo: str | None = None,
) -> AlmacenLocal | AlmacenS3:
    """Construye el almacenamiento indicado por la configuración."""
    local = AlmacenLocal(directorio_base)

    if driver == "local":
        return local
    if driver == "s3":
        if not bucket:
            raise ErrorDeAlmacenamiento("El driver «s3» exige `almacenamiento.bucket`.")
        return AlmacenS3(bucket=bucket, prefijo=prefijo or "", local=local)
    if driver == "cloudinary":
        raise ErrorDeAlmacenamiento(
            "El driver «cloudinary» todavía no está implementado en este scraper. "
            "Usa «local» o «s3», o sube los archivos con el propio portal."
        )

    raise ErrorDeAlmacenamiento(f"Driver de almacenamiento desconocido: {driver}.")
