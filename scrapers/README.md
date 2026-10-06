# Scraper de órdenes de compra y de servicio (OC/OS)

Descarga las órdenes de compra y de servicio que publican las entidades públicas
peruanas, las normaliza a un formato común y las deja en CSV y JSON.

Vive dentro del repositorio del portal de transparencia porque es su alimentador: lo que
descarga aquí es lo que el portal importa después.

---

## Antes de nada: lo que se encontró al reconocer las fuentes

Conviene saberlo porque **cambia el planteamiento** del encargo:

| Suposición del encargo | Lo que hay de verdad |
|---|---|
| `transparencia.gob.pe` publica libros Excel/PDF por entidad, año y mes | En la sección de órdenes **no publica ficheros**. Se comprobaron cinco entidades (ids 1, 100, 1234, 11129 y 20000): las cinco devuelven un formulario con dos desplegables y un botón «Buscar», y **cero** enlaces a archivos |
| Enviar el formulario devuelve los resultados | Devuelve exactamente la misma página. El JavaScript de la página (`enviarOsce()`) hace `window.open(...)` a **SEACE** con el RUC de la entidad, el año y el mes: el portal **delega** |
| SEACE se puede consultar con `requests` | Responde **403** a un cliente que no sea un navegador, **incluso con cabeceras de navegador completas**: es un WAF, y devuelve un JSON de API Gateway. Hace falta Playwright, como decía el encargo |
| Solo hay esas dos fuentes | Hay una tercera, y es **la mejor**: la **Plataforma Nacional de Datos Abiertos** (`datosabiertos.gob.pe`) publica conjuntos en CSV de entidades reales, sin captcha ni WAF. Se implementa como vía recomendada |

Consecuencia para el diseño: el scraper del portal no se limita a "buscar enlaces". Lee
el RUC del formulario y el **puente a SEACE**, y cuando no hay ficheros lo deja dicho en
las advertencias en vez de devolver una lista vacía. Devolver "no hay nada" cuando en
realidad hay que ir a SEACE sería el peor resultado posible.

El detalle y las pruebas están en [`docs/reconocimiento.md`](docs/reconocimiento.md).

---

## Arquitectura

```
scrapers/
├── ocos/
│   ├── config.py            Configuración validada (JSON nativo, YAML opcional)
│   ├── errores.py           Jerarquía de errores previstos
│   ├── logs.py              Registro en línea y en JSON
│   ├── modelos.py           LibroDescargado, OrdenNormalizada, ResultadoEjecucion
│   ├── reintentos.py        Espera exponencial con tope y jitter
│   ├── ruc.py               Validación de RUC (módulo 11)
│   ├── montos.py            Lectura de importes (Decimal, nunca float)
│   ├── fechas.py            Lectura de fechas y periodos
│   ├── parseo_html.py       Enlaces, formulario y puente a SEACE (HTMLParser)
│   ├── tablas.py            Tablas HTML y resultados de SEACE
│   ├── normalizador.py      Filas crudas -> OrdenNormalizada
│   ├── lectores.py          .xls / .xlsx / .csv / .pdf
│   ├── captcha.py           gimpysolver | manual | ninguno
│   ├── http.py              Cliente con límite de frecuencia y reintentos
│   ├── almacenamiento.py    local | s3
│   ├── notificaciones.py    Correo (smtplib) y Slack
│   ├── transparencia.py     Scraper del portal
│   ├── seace.py             Scraper de SEACE (Playwright)
│   ├── datosabiertos.py     Plataforma Nacional de Datos Abiertos (la vía recomendada)
│   ├── orquestador.py       Planifica, ejecuta y escribe las salidas
│   └── __main__.py          Línea de comandos
├── tests/                   116 pruebas con la biblioteca estándar
├── herramientas/
│   └── prueba_de_humo.py    El circuito completo contra una fuente real
├── docs/
│   ├── reconocimiento.md    Evidencia del reconocimiento de las dos fuentes
│   └── estructura-de-datos.md  Campos de salida y su origen
├── config.example.yaml      Configuración de ejemplo
├── config.example.json      Lo mismo en JSON (sin PyYAML)
└── requirements.txt
```

**El núcleo no tiene dependencias.** Validación de RUC, lectura de importes y fechas,
parseo de HTML y de tablas, normalización y configuración usan solo la biblioteca
estándar. Eso permite ejecutar las 80 pruebas sin instalar nada y, sobre todo, que la
parte donde de verdad se decide si el dato es correcto no dependa de terceros.

Los adaptadores (red, navegador, captcha, Excel, S3) importan sus dependencias **dentro
de la función** que las usa: si falta una, el error dice qué instalar en lugar de
reventar al importar el paquete.

## Instalación

```bash
cd scrapers

# Opcional pero recomendado
python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt

# Solo si vas a consultar SEACE (descarga un Chromium)
playwright install chromium

# Comprobar que todo está en su sitio (no necesita nada instalado)
python -m unittest discover -s tests -t .
```

## Uso

```bash
# Ver el plan sin descargar nada
python -m ocos --config config.example.yaml --listar

# Una corrida completa
python -m ocos --config config.example.yaml

# Acotar
python -m ocos --config config.example.yaml --entidad "Municipalidad Distrital de San Ramón"
python -m ocos --config config.example.yaml --periodo 2023-06
python -m ocos --config config.example.yaml --origen seace

# Con registro en archivo (una línea JSON por evento, apto para procesarlo)
python -m ocos --config config.example.yaml --log salida/ocos.log

# Prueba de humo: el circuito completo contra una fuente real (necesita red)
python herramientas/prueba_de_humo.py --config config.example.yaml
```

Códigos de salida, pensados para un cron: `0` todo bien, `1` hubo errores, `2` la
configuración o los argumentos están mal.

### Programado

```cron
# Todos los días 1 a las 06:15, con reintento si el anterior falló.
15 6 1 * * cd /ruta/a/scrapers && .venv/bin/python -m ocos --config config.yaml --log salida/ocos.log
```

## Configuración

Se acepta **JSON** (sin dependencias) y **YAML** (necesita PyYAML). Mira
`config.example.yaml` y `config.example.json`.

Lo mínimo:

```yaml
entidades:
  - nombre: "Municipalidad Distrital de San Ramón"
    ruc: "20146657142"
    id_transparencia: "11129"
    origenes: [transparencia, seace]
    periodos: ["2023-06"]
```

Reglas que la configuración hace cumplir **al arrancar** (no a mitad de una corrida de
tres horas):

* `segundos_entre_peticiones` no puede bajar de 1: el encargo pide respetar los servidores.
* `origenes: [seace]` exige `ruc`; `origenes: [transparencia]` exige `id_transparencia` o `ruc`.
* Los periodos se validan (`AAAA-MM` u objeto `{anio, mes}`).
* Los resolvedores de captcha y los drivers de almacenamiento, contra su lista.

Las credenciales **no van en el archivo** (se versiona). Se leen del entorno:
`OCOS_SMTP_HOST`, `OCOS_SMTP_PORT`, `OCOS_SMTP_USER`, `OCOS_SMTP_PASSWORD`,
`OCOS_SMTP_FROM`, `OCOS_SLACK_WEBHOOK`.

## Salida

En `salida/` (configurable):

```
salida/
├── transparencia/<entidad>/<año>/<mes>/<archivo>.xls
├── captchas/                  Captchas que no se pudieron resolver
└── datos/
    ├── ordenes-<marca>.csv    Una fila por orden, cabeceras fijas
    ├── ordenes-<marca>.json   Lo mismo, con los avisos como lista
    ├── libros-<marca>.json    Inventario de lo descargado, con checksum SHA-256
    └── resumen-<marca>.json   Cifras de la corrida
```

Los campos y su origen están en
[`docs/estructura-de-datos.md`](docs/estructura-de-datos.md).

## Pruebas

```bash
python -m unittest discover -s tests -t . -v
```

116 pruebas. **Sin dependencias externas**: las que necesitan `openpyxl` o `xlrd` se
saltan solas si no están instalados, así que la batería corre igual en un entorno
limpio. Cubren, entre otras cosas:

* RUC: se usan RUC reales y públicos (el que la propia administración publica en su
  formulario) y casos con el dígito de control alterado.
* Importes: `1,234.56`, `1.234,56`, `1,234`, `12,5`, negativos entre paréntesis, `N/A`.
* Fechas: `dd/mm/aaaa`, ISO, con hora, y lo que no se puede leer.
* El HTML del portal: el RUC del formulario, las opciones de año y mes y el puente a SEACE.
* Tablas anidadas de JSF y que **falte** la tabla de resultados (debe avisar, no devolver
  una lista vacía).
* Normalización: que una fila con problemas llegue **con avisos** en vez de desaparecer.

Dos pruebas encontraron bugs reales durante el desarrollo, y se quedaron como regresión:
el alias «proveedor» encajaba dentro de «RUC Proveedor» (el nombre salía siendo el RUC) y
`1,234` se leía como 1,234.

## Limitaciones

1. **SEACE no está verificado contra el sitio real.** Responde **403 incluso con
   cabeceras de navegador completas** (devuelve un JSON de API Gateway), así que desde
   un entorno que no sea el de producción no se puede inspeccionar su DOM. Los selectores
   están como **listas de candidatos** y, si ninguno casa, el error dice qué se buscaba.
   Antes de usarlo: `navegador_visible: true`, una consulta, y ajustar `SELECTORES` en
   `seace.py`. **Para eso ya no hace falta:** usa la vía de datos abiertos.
2. **El objetivo de «80 % de acierto en captcha» no se puede afirmar.** Es la cifra que
   declara el autor de `gimpysolver` (4000 imágenes entrenadas). Aquí no se ha podido
   medir: haría falta ejecutarlo contra SEACE. El resolvedor guarda **cada captcha que
   falla**, que es lo que permite medirlo de verdad.
3. **La vía de ficheros del portal está probada con HTML real, pero no con un libro real**
   descargado: en las cinco entidades comprobadas no había ninguno. Los lectores de Excel
   sí están probados (`.xlsx` con `openpyxl` y `.csv` con la biblioteca estándar, incluida
   la detección de la cabecera bajo las filas de título). El `.xls` clásico no se ha podido
   probar: no se encontró ningún fichero de ese formato que descargar.
4. **La vía de datos abiertos sí está verificada de punta a punta** con un conjunto real
   (GORE Áncash, 4.131 órdenes): búsqueda, página del conjunto, descarga, lectura y
   normalización. Reproducible con `python herramientas/prueba_de_humo.py`.
5. **`gimpysolver` es GPL.** Revísalo si vas a distribuir esto.
6. **Cloudinary no está implementado** en este scraper (el portal sí lo tiene previsto).
   Se admiten `local` y `s3`.
7. **La paginación de SEACE** se apoya en un enlace «Siguiente». Si el buscador pagina por
   postback con otro texto, habrá que añadir el selector.

## Aviso de uso

Resolver automáticamente un captcha es sortear una medida técnica del sitio. Los datos son
públicos y la finalidad es de transparencia (Ley 27806), pero conviene revisar las
condiciones de uso de SEACE y **preferir siempre la vía de datos abiertos** cuando exista.
El cliente HTTP respeta un intervalo mínimo entre peticiones y la concurrencia por defecto
es 1: no lo subas sin motivo.

## Próximos pasos

1. ~~Añadir la vía de datos abiertos~~: **hecho** (`datosabiertos.py`). Es la que hay que
   usar por defecto.
2. Cargar en la configuración los conjuntos de las entidades que interesen: en
   `datosabiertos.gob.pe` hay más de diez de órdenes de compra y servicio.
3. Encadenar la salida con el importador del portal, para no importar a mano.
4. Si de verdad hace falta SEACE (entidades que no publican datos abiertos): ejecutarlo
   una vez con el navegador a la vista y fijar los selectores, y medir el acierto del
   captcha con las imágenes de respaldo.
