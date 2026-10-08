# Libros mensuales de SEACE desde el administrador

El generador funciona dentro de la web existente. No requiere un servicio adicional,
Docker, tokens, almacenamiento de descargas ni cambiar el plan de Render.

1. Entrar en **Admin → Descargas SEACE**.
2. Elegir el año, por ejemplo **2020**. Aparecen enero a diciembre automáticamente.
3. Pulsar **Abrir mes en SEACE**, o **Abrir los 12 meses** para abrir las doce consultas.
4. En cada pestaña de SEACE, pulsar el botón de descarga de Excel que ofrece la página.
5. Guardar los originales en la computadora y subirlos después en **Importar** para
   revisar y confirmar sus datos.

El navegador puede bloquear las pestañas adicionales. Permitir ventanas emergentes
para el dominio de fiscalizador y repetir la acción, o usar los doce enlaces individuales.
El panel indica cuántas pestañas consiguió abrir; no las presenta como Excel descargados.
**Copiar los 12 enlaces** copia las consultas por mes para guardarlas o compartirlas.
Si no está disponible el portapapeles, aparece un cuadro para copiar el texto manualmente.

## Municipalidad

Por defecto: Municipalidad Distrital de San Ramón, RUC **20146657142**.
La opción **Consultar otra municipalidad** permite cambiar nombre y RUC para la consulta.
No cambia el municipio publicado, las importaciones ni las cifras del portal.
Al recargar la página vuelve San Ramón. La URL siempre apunta al mismo buscador oficial.

Ejemplo de diciembre de 2015:

```text
https://prod2.seace.gob.pe/seacebus-uiwd-pub/buscadorPublico/ongei/buscadorPublicoOCOS.xhtml?ruc_entidad=20146657142&anio=2015&mes=12&theme=ongei
```

## Alcance

Esto automatiza la generación y apertura de los doce meses, evitando escribir año y mes
para cada consulta. No solicita datos a SEACE desde Render ni requiere una API de SEACE.
El acceso a SEACE y la descarga ocurren en el navegador del administrador.
Por las restricciones entre sitios, el portal no puede pulsar los botones dentro de SEACE.
Abrir los doce meses **no equivale a descargar automáticamente doce Excel**.

El script local de `scrapers/herramientas/descargar_excel_anual.py` sigue disponible como
alternativa opcional para usar un navegador en la computadora; ver `scrapers/README.md`.
El acceso y el botón real dependen de SEACE. No se evade CAPTCHA ni se marca un error
como un mes sin gastos. El generador utiliza el formato del enlace proporcionado;
el sitio no pudo comprobarse desde desarrollo porque respondió 403.

Se retiró la implementación anterior del worker y del ZIP en el servidor.
Ya no se usan `SEACE_WORKER_URL` ni `SEACE_WORKER_TOKEN`.
Los originales y datos de importaciones existentes no se eliminan.
