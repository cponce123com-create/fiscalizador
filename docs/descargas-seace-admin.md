# Libros mensuales de SEACE desde el administrador

El generador funciona dentro de la web existente. No requiere un servicio adicional,
Docker, tokens, almacenamiento de descargas ni cambiar el plan de Render.

1. Entrar en **Admin → Descargas SEACE**.
2. Elegir el año, por ejemplo **2020**. Aparecen enero a diciembre automáticamente.
3. **Descargar los 12 Excel** intenta descargar los originales en secuencia. Para comprobar
   el acceso desde Render, probar primero **Descargar Excel** de un mes conocido.
   Permitir descargas múltiples si Chrome lo solicita y comprobar los archivos en Descargas.
4. Como alternativa, pulsar **Abrir mes en SEACE**, o **Abrir los 12 meses** para abrir las doce consultas.
5. En cada pestaña de SEACE, pulsar el botón de descarga de Excel que ofrece la página.
6. Guardar los originales en la computadora y subirlos después en **Importar** para
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

El modo HTTP usa el servicio web existente para hacer GET de cada mes y POST del formulario
de exportación con una sesión nueva. Los campos son `formBuscador`, `formBuscador:btnExportar`
(vacío), `formBuscador:hddIniciaBusqueda` y `javax.faces.ViewState` obtenido de ese GET.
Las cookies proceden de SEACE en ese intento, no del navegador del usuario, y no se guardan,
registran ni devuelven al cliente. No se reutilizan las cookies ni los tokens aportados en la conversación.

Se comprueba el periodo de la página, el formulario, el tipo de respuesta y que el archivo
sea un Excel legible. Hasta 2 MB de HTML y 25 MB por libro, 40 s por mes, dos solicitudes
concurrentes por proceso y una por usuario. Se conservan los bytes originales; el nombre
incluye año, mes y municipalidad. No hay almacenamiento en servidor ni importación automática.
Si un mes falla, se detiene la secuencia para no lanzar doce solicitudes bloqueadas.
El panel permite volver a descargar un mes individual o continuar con los pendientes.
El progreso es de esta pestaña; recargar lo reinicia. Archivo enviado al navegador no confirma
que Chrome haya permitido guardarlo: revisar Descargas y permitir descargas múltiples.

**Aún no se verificó una descarga real desde Render.** Con el formulario facilitado por el
usuario, las pruebas simulan GET, cookies, estado nuevo y POST, y comparan los bytes del Excel.
La consulta real desde desarrollo sigue respondiendo 403 antes de obtener el formulario.
Un 403, CAPTCHA, redirección o página HTML se informa como error. El modo directo depende
de que SEACE acepte la conexión desde Render; no se garantiza su disponibilidad.

Los enlaces manuales siguen funcionando sin consultas a SEACE desde Render. Por las restricciones
entre sitios, el portal no pulsa botones dentro de las pestañas de SEACE. Abrir los doce meses
no equivale a descargar automáticamente los Excel: para ello se utiliza el botón de modo HTTP.

El script local de `scrapers/herramientas/descargar_excel_anual.py` sigue disponible como
alternativa opcional para usar un navegador en la computadora; ver `scrapers/README.md`.
El acceso y el botón real dependen de SEACE. No se evade CAPTCHA ni se marca un error
como un mes sin gastos. El generador utiliza el formato del enlace proporcionado;
el sitio no pudo comprobarse desde desarrollo porque respondió 403.

Se retiró la implementación anterior del worker y del ZIP en el servidor.
Ya no se usan `SEACE_WORKER_URL` ni `SEACE_WORKER_TOKEN`.
Los originales y datos de importaciones existentes no se eliminan.
