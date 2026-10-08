# Libros SEACE: descarga desde el navegador

La captura de producción confirmó un HTTP 403 cuando Render intentó abrir SEACE.
El navegador del administrador sí pudo exportar el Excel con un POST 200.
La automatización se ejecuta ahora en esa computadora, dentro de la página oficial.
No requiere otro servicio, Docker, tokens, extensiones ni modificar el plan de Render.

## Uso

1. Entrar en **Admin → Descargas SEACE** y elegir el año.
2. Pulsar **Descarga automática en mi navegador**.
3. Mostrar la barra de marcadores con **Ctrl + Shift + B** y arrastrar el enlace
   **Descargar SEACE [año]** a esa barra.
4. Abrir enero con el enlace del panel. Ya dentro de SEACE, pulsar el marcador guardado.
5. Permitir las descargas múltiples si Chrome lo solicita y mantener la pestaña abierta.

Si no se puede arrastrar, crear un marcador manualmente y pegar en su campo URL el
código que muestra el panel. El código empieza por `javascript:`. No se pega en DevTools.
Si cambia el año o RUC, hay que crear o actualizar el marcador con el nuevo enlace.
Solo funciona en la página oficial de consulta; pulsarlo en otra web muestra instrucciones.

## Progreso y archivos

El panel flotante de SEACE muestra cuántos archivos se enviaron al navegador.
Se consultan los doce meses en orden: GET con un estado JSF nuevo y POST de exportación
con los campos del formulario observado. Las solicitudes son del mismo origen;
el navegador maneja sus propias cookies, sin copiarlas ni enviarlas a fiscalizador.
Los originales no se transforman: se conserva su contenido y se asigna un nombre con
municipalidad, año y mes. Hasta 2 MB de HTML y 25 MB por libro, con 45 s por mes.
Se comprueba el periodo, el formulario, respuesta adjunta y firma de Excel; no se extraen
las quince filas de la tabla paginada para fabricar un Excel incompleto.

**Pausar** espera a terminar el mes actual. Cerrar el panel y volver a pulsar el marcador
continúa desde los pendientes. Los meses enviados se guardan en localStorage de SEACE,
por RUC/año. **Reiniciar progreso** permite repetirlos si Chrome bloqueó los archivos.
Archivo enviado no garantiza que se guardó: comprobar la carpeta Descargas.
Evitar otras consultas SEACE mientras trabaja el marcador y mantener la pestaña abierta.

Un 403, respuesta HTML, archivo inválido o periodo diferente detiene la secuencia y
no marca ese mes como enviado. No se evaden CAPTCHA ni se desactivan protecciones.
El script no lee cookies mediante JavaScript, no usa credenciales del admin y solo
hace solicitudes a la URL oficial de SEACE. No hay tráfico ni almacenamiento de libros
nuevo en Render, ni importaciones automáticas.

## Alternativa manual y otras municipalidades

Siguen disponibles **Abrir mes en SEACE**, **Abrir los 12 meses** y **Copiar los 12 enlaces**.
Abrir pestañas no pulsa el botón Excel: en modo manual se descarga desde cada página.
El navegador puede bloquear pestañas adicionales; permitirlas o usar los enlaces individuales.

Por defecto se consulta San Ramón, RUC **20146657142**. La sección **Consultar otra municipalidad**
permite cambiar nombre y RUC para estos enlaces y el marcador. No modifica el municipio
publicado ni las importaciones; al recargar vuelve San Ramón.

## Verificación pendiente

Las pruebas ejecutan el código serializado del marcador en un navegador simulado y
comprueban doce GET/POST, estados nuevos, contenido intacto, progreso y error 403.
No se ha comprobado una descarga completa con el marcador en el navegador real del usuario.
SEACE o el navegador pueden bloquear su ejecución con CSP o sus políticas de descarga.
Si no inicia o devuelve error, conservar los enlaces manuales; no desactivar esas protecciones.
El script local opcional sigue en `scrapers/herramientas/descargar_excel_anual.py`.

Se retiró el endpoint que descargaba desde Render, porque en producción recibió 403.
Los libros e importaciones ya existentes no se eliminan.
