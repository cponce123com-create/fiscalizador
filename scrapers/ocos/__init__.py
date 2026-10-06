"""Scraper de libros de órdenes de compra y de servicio.

Estructura:

* `config` — configuración validada.
* `parseo_html`, `tablas`, `normalizador`, `ruc`, `montos`, `fechas` — **núcleo puro**,
  sin dependencias externas y con pruebas.
* `transparencia`, `seace` — scrapers (necesitan red y navegador).
* `captcha`, `lectores`, `almacenamiento`, `notificaciones` — adaptadores.
* `orquestador` — coordina todo.
"""

from __future__ import annotations

__version__ = "0.1.0"
