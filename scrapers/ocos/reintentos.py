"""Reintentos con espera exponencial.

El backoff se calcula aquí, en una función pura y comprobable, en lugar de repartirlo
por los scrapers. Así la política es una sola y se puede probar sin red ni esperas
reales: las pruebas inyectan un `dormir` que solo apunta cuánto se le pidió dormir.
"""

from __future__ import annotations

import random
import time
from dataclasses import dataclass
from typing import Callable, Iterable, TypeVar

from .errores import ErrorOCOS

T = TypeVar("T")


@dataclass(frozen=True)
class PoliticaReintentos:
    """Cuántas veces reintentar y cuánto esperar entre intentos."""

    intentos: int = 3
    espera_inicial: float = 5.0
    factor: float = 2.0
    espera_maxima: float = 60.0
    #: Proporción de aleatoriedad añadida (0.25 = hasta un 25 % más). Evita que varios
    #: procesos reintenten a la vez y golpeen el servidor en el mismo instante.
    jitter: float = 0.25

    def __post_init__(self) -> None:
        if self.intentos < 1:
            raise ValueError("La política debe permitir al menos un intento.")
        if self.espera_inicial < 0 or self.factor < 1:
            raise ValueError("La espera inicial no puede ser negativa y el factor, menor que 1.")

    def espera_del_intento(self, intento: int, *, aleatorio: random.Random | None = None) -> float:
        """Segundos a esperar **antes** del intento indicado (1 = el primero, no espera).

        El resultado nunca supera `espera_maxima`, ni siquiera tras aplicar el jitter.
        """
        if intento <= 1:
            return 0.0

        base = self.espera_inicial * (self.factor ** (intento - 2))
        base = min(base, self.espera_maxima)

        if self.jitter <= 0:
            return base

        rng = aleatorio or random
        return min(base * (1 + rng.uniform(0, self.jitter)), self.espera_maxima)


def con_reintentos(
    funcion: Callable[[], T],
    politica: PoliticaReintentos | None = None,
    *,
    excepciones: Iterable[type[BaseException]] = (ErrorOCOS,),
    dormir: Callable[[float], None] = time.sleep,
    al_reintentar: Callable[[int, BaseException, float], None] | None = None,
) -> T:
    """Ejecuta `funcion` reintentando los fallos previstos.

    Solo se reintentan las excepciones de `excepciones`: un error de configuración o de
    programación debe salir de inmediato, no repetirse tres veces.

    :param al_reintentar: se llama con (intento fallido, error, espera) antes de dormir.
    """
    politica = politica or PoliticaReintentos()
    ultimo_error: BaseException | None = None

    for intento in range(1, politica.intentos + 1):
        espera = politica.espera_del_intento(intento)
        if espera > 0:
            dormir(espera)

        try:
            return funcion()
        except tuple(excepciones) as error:  # type: ignore[misc]
            ultimo_error = error
            if intento == politica.intentos:
                break
            if al_reintentar is not None:
                al_reintentar(intento, error, politica.espera_del_intento(intento + 1))

    assert ultimo_error is not None  # el bucle no puede terminar sin error
    raise ultimo_error
