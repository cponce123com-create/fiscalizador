"""Configuración del scraper.

Se acepta **JSON** (biblioteca estándar) y **YAML** (requiere PyYAML, declarado en
`requirements.txt`). La validación se hace siempre sobre un diccionario ya cargado, así
que es la misma para los dos formatos y se puede probar sin tener PyYAML instalado.

Filosofía: si la configuración está mal, se falla **al arrancar** y con un mensaje que
diga qué entidad y qué campo. Un error de configuración descubierto a mitad de una
corrida de tres horas es tiempo perdido.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .errores import ErrorDeConfiguracion
from .fechas import parsear_periodo

ORIGENES_VALIDOS = ("transparencia", "seace")
ALMACENAMIENTOS_VALIDOS = ("local", "s3", "cloudinary")


@dataclass(frozen=True)
class Periodo:
    """Un mes concreto de un año concreto."""

    anio: int
    mes: int

    @property
    def etiqueta(self) -> str:
        return f"{self.anio}-{self.mes:02d}"


@dataclass(frozen=True)
class Entidad:
    """Una entidad pública de la que se quieren los libros."""

    nombre: str
    ruc: str | None = None
    id_transparencia: str | None = None
    origenes: tuple[str, ...] = ("transparencia", "seace")
    periodos: tuple[Periodo, ...] = ()
    notas: str | None = None


@dataclass(frozen=True)
class AjustesDeRed:
    """Cómo comportarse con los servidores ajenos."""

    segundos_entre_peticiones: float = 2.0
    timeout: float = 45.0
    user_agent: str = (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0 Safari/537.36"
    )
    reintentos: int = 3
    espera_inicial: float = 5.0
    espera_maxima: float = 60.0
    concurrencia: int = 1
    navegador_visible: bool = False
    timeout_navegador: float = 60.0


@dataclass(frozen=True)
class AjustesDeCaptcha:
    """Resolución del captcha de SEACE."""

    #: `gimpysolver`, `manual` o `ninguno`.
    resolvedor: str = "gimpysolver"
    #: Intentos de captcha antes de rendirse con esa página.
    intentos: int = 3
    #: Segundos que se espera a una persona si el resolvedor es `manual`.
    espera_manual: float = 180.0
    #: Directorio donde dejar los captchas no resueltos, para revisarlos después.
    directorio_de_respaldo: str = "salida/captchas"


@dataclass(frozen=True)
class AjustesDeAlmacenamiento:
    """Dónde se dejan los archivos y los datos."""

    driver: str = "local"
    directorio_base: str = "salida"
    subir_a: str | None = None
    bucket: str | None = None
    prefijo: str | None = None


@dataclass(frozen=True)
class AjustesDeNotificacion:
    """A quién se avisa cuando algo va mal."""

    email_para: str | None = None
    slack_webhook: str | None = None
    solo_si_hay_errores: bool = True


@dataclass(frozen=True)
class Configuracion:
    """Configuración completa, ya validada."""

    entidades: tuple[Entidad, ...]
    red: AjustesDeRed = field(default_factory=AjustesDeRed)
    captcha: AjustesDeCaptcha = field(default_factory=AjustesDeCaptcha)
    almacenamiento: AjustesDeAlmacenamiento = field(default_factory=AjustesDeAlmacenamiento)
    notificacion: AjustesDeNotificacion = field(default_factory=AjustesDeNotificacion)
    nivel_de_registro: str = "INFO"


def _exigir(diccionario: dict[str, Any], clave: str, contexto: str) -> Any:
    if clave not in diccionario or diccionario[clave] in (None, ""):
        raise ErrorDeConfiguracion(f"Falta «{clave}» en {contexto}.")
    return diccionario[clave]


def _periodos(crudos: Any, contexto: str) -> tuple[Periodo, ...]:
    if not isinstance(crudos, list) or not crudos:
        raise ErrorDeConfiguracion(f"«{contexto}» debe ser una lista con al menos un periodo.")

    periodos: list[Periodo] = []
    for crudo in crudos:
        if isinstance(crudo, str):
            coincidencia = crudo.strip().split("-")
            if len(coincidencia) != 2 or not all(parte.isdigit() for parte in coincidencia):
                raise ErrorDeConfiguracion(
                    f"Periodo mal escrito en {contexto}: «{crudo}». Se espera «AAAA-MM»."
                )
            anio, mes = int(coincidencia[0]), int(coincidencia[1])
        elif isinstance(crudo, dict):
            anio = int(_exigir(crudo, "anio", contexto))
            mes = int(_exigir(crudo, "mes", contexto))
        else:
            raise ErrorDeConfiguracion(f"Periodo no reconocido en {contexto}: {crudo!r}.")

        try:
            parsear_periodo(anio, mes)
        except ValueError as error:
            raise ErrorDeConfiguracion(f"En {contexto}: {error}") from error

        periodos.append(Periodo(anio=anio, mes=mes))

    return tuple(periodos)


def _entidad(crudo: dict[str, Any], indice: int) -> Entidad:
    contexto = f"entidades[{indice}]"
    if not isinstance(crudo, dict):
        raise ErrorDeConfiguracion(f"{contexto} debe ser un objeto.")

    nombre = str(_exigir(crudo, "nombre", contexto))
    origenes = tuple(crudo.get("origenes") or ORIGENES_VALIDOS)

    desconocidos = [origen for origen in origenes if origen not in ORIGENES_VALIDOS]
    if desconocidos:
        raise ErrorDeConfiguracion(
            f"{contexto}: origen no soportado {desconocidos}. Válidos: {', '.join(ORIGENES_VALIDOS)}."
        )

    ruc = crudo.get("ruc")
    id_transparencia = crudo.get("id_transparencia")

    if "seace" in origenes and not ruc:
        raise ErrorDeConfiguracion(f"{contexto}: «seace» exige «ruc».")
    if "transparencia" in origenes and not id_transparencia and not ruc:
        raise ErrorDeConfiguracion(f"{contexto}: «transparencia» exige «id_transparencia» o «ruc».")

    return Entidad(
        nombre=nombre,
        ruc=str(ruc) if ruc else None,
        id_transparencia=str(id_transparencia) if id_transparencia else None,
        origenes=origenes,
        periodos=_periodos(_exigir(crudo, "periodos", contexto), contexto),
        notas=crudo.get("notas"),
    )


def desde_diccionario(datos: dict[str, Any]) -> Configuracion:
    """Valida un diccionario ya cargado y construye la configuración."""
    if not isinstance(datos, dict):
        raise ErrorDeConfiguracion("La configuración debe ser un objeto.")

    entidades_crudas = datos.get("entidades")
    if not isinstance(entidades_crudas, list) or not entidades_crudas:
        raise ErrorDeConfiguracion("«entidades» debe ser una lista con al menos una entidad.")

    entidades = tuple(_entidad(cruda, i) for i, cruda in enumerate(entidades_crudas))

    red_cruda = datos.get("red") or {}
    captcha_crudo = datos.get("captcha") or {}
    almacenamiento_crudo = datos.get("almacenamiento") or {}
    notificacion_crudo = datos.get("notificacion") or {}

    red = AjustesDeRed(
        segundos_entre_peticiones=float(red_cruda.get("segundos_entre_peticiones", 2.0)),
        timeout=float(red_cruda.get("timeout", 45.0)),
        user_agent=str(red_cruda.get("user_agent", AjustesDeRed.user_agent)),
        reintentos=int(red_cruda.get("reintentos", 3)),
        espera_inicial=float(red_cruda.get("espera_inicial", 5.0)),
        espera_maxima=float(red_cruda.get("espera_maxima", 60.0)),
        concurrencia=max(1, int(red_cruda.get("concurrencia", 1))),
        navegador_visible=bool(red_cruda.get("navegador_visible", False)),
        timeout_navegador=float(red_cruda.get("timeout_navegador", 60.0)),
    )

    if red.segundos_entre_peticiones < 1:
        raise ErrorDeConfiguracion(
            "«segundos_entre_peticiones» no puede ser menor que 1: el pliego pide "
            "respetar los servidores públicos."
        )

    captcha = AjustesDeCaptcha(
        resolvedor=str(captcha_crudo.get("resolvedor", "gimpysolver")),
        intentos=int(captcha_crudo.get("intentos", 3)),
        espera_manual=float(captcha_crudo.get("espera_manual", 180.0)),
        directorio_de_respaldo=str(captcha_crudo.get("directorio_de_respaldo", "salida/captchas")),
    )
    if captcha.resolvedor not in ("gimpysolver", "manual", "ninguno"):
        raise ErrorDeConfiguracion(
            f"«captcha.resolvedor» no soportado: {captcha.resolvedor}. "
            "Válidos: gimpysolver, manual, ninguno."
        )

    driver = str(almacenamiento_crudo.get("driver", "local"))
    if driver not in ALMACENAMIENTOS_VALIDOS:
        raise ErrorDeConfiguracion(
            f"«almacenamiento.driver» no soportado: {driver}. "
            f"Válidos: {', '.join(ALMACENAMIENTOS_VALIDOS)}."
        )

    almacenamiento = AjustesDeAlmacenamiento(
        driver=driver,
        directorio_base=str(almacenamiento_crudo.get("directorio_base", "salida")),
        subir_a=almacenamiento_crudo.get("subir_a"),
        bucket=almacenamiento_crudo.get("bucket"),
        prefijo=almacenamiento_crudo.get("prefijo"),
    )

    notificacion = AjustesDeNotificacion(
        email_para=notificacion_crudo.get("email_para"),
        slack_webhook=notificacion_crudo.get("slack_webhook"),
        solo_si_hay_errores=bool(notificacion_crudo.get("solo_si_hay_errores", True)),
    )

    return Configuracion(
        entidades=entidades,
        red=red,
        captcha=captcha,
        almacenamiento=almacenamiento,
        notificacion=notificacion,
        nivel_de_registro=str(datos.get("nivel_de_registro", "INFO")).upper(),
    )


def cargar(ruta: str | Path) -> Configuracion:
    """Carga y valida la configuración desde un `.json` o un `.yaml`."""
    camino = Path(ruta)
    if not camino.exists():
        raise ErrorDeConfiguracion(f"No existe el archivo de configuración: {camino}.")

    texto = camino.read_text(encoding="utf-8")

    if camino.suffix.lower() == ".json":
        try:
            datos = json.loads(texto)
        except json.JSONDecodeError as error:
            raise ErrorDeConfiguracion(f"El JSON no es válido ({camino}): {error}") from error
    else:
        try:
            import yaml  # type: ignore[import-not-found]
        except ImportError as error:
            raise ErrorDeConfiguracion(
                "Para leer YAML hace falta PyYAML (`pip install PyYAML`). "
                "También puedes usar un archivo .json, que no necesita dependencias."
            ) from error

        try:
            datos = yaml.safe_load(texto)
        except yaml.YAMLError as error:  # type: ignore[attr-defined]
            raise ErrorDeConfiguracion(f"El YAML no es válido ({camino}): {error}") from error

    return desde_diccionario(datos)
