"""Avisos cuando algo va mal.

Dos canales, los dos opcionales y los dos sin dependencias obligatorias:

* **Correo** por `smtplib`, que viene con Python. Necesita un servidor SMTP en el
  entorno (`OCOS_SMTP_HOST`, `OCOS_SMTP_PORT`, `OCOS_SMTP_USER`, `OCOS_SMTP_PASSWORD`).
  Las credenciales **nunca** van en el archivo de configuración: ese archivo se
  versiona.
* **Slack** por webhook. La URL del webhook también es un secreto, así que se lee del
  entorno (`OCOS_SLACK_WEBHOOK`) y no de la configuración.

Si un canal falla, se registra y se sigue: no poder avisar no puede tumbar la corrida.
"""

from __future__ import annotations

import json
import os
import smtplib
import urllib.error
import urllib.request
from dataclasses import dataclass
from email.message import EmailMessage

from .logs import REGISTRO, con_contexto
from .modelos import ResultadoEjecucion


def _texto_del_resumen(resultado: ResultadoEjecucion) -> str:
    resumen = resultado.resumen()
    lineas = [
        "Corrida del scraper de órdenes de compra y servicio",
        "",
        f"Inicio:               {resumen['iniciado_en']}",
        f"Fin:                  {resumen['terminado_en']}",
        f"Libros descargados:   {resumen['libros_descargados']}",
        f"Órdenes extraídas:    {resumen['ordenes_normalizadas']}",
        f"Órdenes completas:    {resumen['ordenes_completas']}",
        f"Errores:              {resumen['errores']}",
        f"Advertencias:         {resumen['advertencias']}",
    ]

    if resultado.errores:
        lineas.extend(["", "Errores:"])
        lineas.extend(f"  - {error}" for error in resultado.errores[:20])

    # chr(10) es el salto de línea.
    return chr(10).join(lineas)


@dataclass
class NotificadorCorreo:
    """Envía el resumen por correo."""

    para: str
    servidor: str | None = None
    puerto: int = 587
    usuario: str | None = None
    contrasena: str | None = None
    remitente: str = "scraper-ocos@localhost"

    @classmethod
    def desde_entorno(cls, para: str) -> "NotificadorCorreo":
        return cls(
            para=para,
            servidor=os.environ.get("OCOS_SMTP_HOST"),
            puerto=int(os.environ.get("OCOS_SMTP_PORT", "587")),
            usuario=os.environ.get("OCOS_SMTP_USER"),
            contrasena=os.environ.get("OCOS_SMTP_PASSWORD"),
            remitente=os.environ.get("OCOS_SMTP_FROM", "scraper-ocos@localhost"),
        )

    def enviar(self, resultado: ResultadoEjecucion) -> None:
        if not self.servidor:
            REGISTRO.info(
                "Sin OCOS_SMTP_HOST: no se envía correo.", extra=con_contexto(paso="notificacion")
            )
            return

        mensaje = EmailMessage()
        mensaje["Subject"] = f"Scraper OCOS: {resultado.resumen()['errores']} error(es)"
        mensaje["From"] = self.remitente
        mensaje["To"] = self.para
        mensaje.set_content(_texto_del_resumen(resultado))

        try:
            with smtplib.SMTP(self.servidor, self.puerto, timeout=30) as smtp:
                smtp.starttls()
                if self.usuario and self.contrasena:
                    smtp.login(self.usuario, self.contrasena)
                smtp.send_message(mensaje)
        except Exception as error:
            REGISTRO.error(
                f"No se pudo enviar el correo de aviso: {error}",
                extra=con_contexto(paso="notificacion"),
            )


@dataclass
class NotificadorSlack:
    """Avisa por webhook de Slack."""

    webhook: str | None = None

    @classmethod
    def desde_entorno(cls) -> "NotificadorSlack":
        return cls(webhook=os.environ.get("OCOS_SLACK_WEBHOOK"))

    def enviar(self, resultado: ResultadoEjecucion) -> None:
        if not self.webhook:
            return

        resumen = resultado.resumen()
        texto = (
            f"*Scraper OCOS*: {resumen['libros_descargados']} libros, "
            f"{resumen['ordenes_normalizadas']} órdenes, "
            f"{resumen['errores']} error(es)."
        )
        if resultado.errores:
            texto += chr(10) + chr(10).join(f"• {error}" for error in resultado.errores[:10])

        peticion = urllib.request.Request(
            self.webhook,
            data=json.dumps({"text": texto}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(peticion, timeout=20):  # noqa: S310 - URL de configuración
                pass
        except (urllib.error.URLError, OSError) as error:
            REGISTRO.error(
                f"No se pudo avisar a Slack: {error}", extra=con_contexto(paso="notificacion")
            )


def notificar(
    resultado: ResultadoEjecucion,
    *,
    email_para: str | None = None,
    slack_webhook: str | None = None,
    solo_si_hay_errores: bool = True,
) -> None:
    """Avisa por los canales configurados."""
    if solo_si_hay_errores and not resultado.errores:
        REGISTRO.debug(
            "Sin errores: no se notifica.", extra=con_contexto(paso="notificacion")
        )
        return

    if email_para:
        NotificadorCorreo.desde_entorno(email_para).enviar(resultado)

    if slack_webhook:
        NotificadorSlack(webhook=slack_webhook).enviar(resultado)
