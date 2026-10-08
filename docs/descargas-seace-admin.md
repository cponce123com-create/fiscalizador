# Descarga automática de los doce Excel de SEACE

El panel tiene un botón **Descargar los 12 Excel**. La automatización usa una
extensión local de Chrome y trabaja en la computadora del administrador. No
requiere servicios de pago, nuevas variables ni un cambio del plan de Render.

## Instalación única

1. En **Admin → Descargas SEACE**, pulsar **Instalar descargador gratuito**.
2. Descargar el ZIP y extraer todos los archivos en una carpeta permanente.
3. Abrir `chrome://extensions`, activar **Modo de desarrollador** y pulsar
   **Cargar descomprimida**. Seleccionar la carpeta que contiene `manifest.json`.
4. Recargar el panel. Seleccionar el año y pulsar **Descargar los 12 Excel**.

También funciona antes de publicar el panel nuevo: pulsar el icono de la extensión
en Chrome, seleccionar el año y pulsar su botón de descarga. Chrome de escritorio
116 o posterior. No cerrar la pestaña del descargador durante el trabajo.

## Descarga y comprobaciones

Cerrar otras pestañas de SEACE antes de empezar. La extensión abre una sola consulta
auxiliar y la reutiliza. Por cada mes:

1. Navegar al enlace oficial con RUC, año y mes, y esperar a que la página cargue.
2. Comprobar periodo, URL y formulario JSF. Exportar con un `ViewState` fresco y
   los cuatro campos reales del botón Excel. Las cookies permanecen en Chrome.
3. Leer el Excel original, hasta 25 MB y 60 segundos, rechazando errores HTTP,
   páginas HTML, CAPTCHA y contenido sin firma de Excel.
4. Comprobar que las fechas de emisión incluyen el mes solicitado. Si enero
   devuelve diciembre, detenerse antes de guardar un archivo mal etiquetado.
   Los reportes con fechas mezcladas se guardan con un aviso para la importación.
   Un libro vacío se conserva si tiene los encabezados esperados.
5. Detectar una repetición SHA-256 de un libro no vacío ya descargado.
6. Guardar los bytes originales con nombre por año, mes y municipalidad; esperar
   a que la API de descargas de Chrome confirme `complete` antes del mes siguiente.

No se marca el mes por un clic, un temporizador ni una petición iniciada.
El panel del descargador muestra archivos guardados, filas y errores. Si Chrome
interrumpe una descarga o no la confirma en cinco minutos, se detiene la secuencia.
**Detener después de este mes** espera al archivo actual. Reintentar en la misma
pestaña descarga solo los meses pendientes del mismo RUC/año. Al cerrar la pestaña,
este progreso en memoria se pierde; las descargas ya realizadas permanecen en el disco.
La pestaña auxiliar creada por la extensión se cierra al terminar o fallar.

El botón del panel abre el descargador automáticamente con el año elegido.
También se puede utilizar su icono en Chrome, sin el panel. Si ya hay un descargador
abierto, se evita iniciar otro. Los enlaces manuales quedan en una sección secundaria.
La extensión exige cerrar otras consultas SEACE y detiene el proceso si detecta
una nueva, para evitar el estado compartido observado entre pestañas.

## Permisos, paquete y despliegue

La extensión MV3 requiere `scripting` y `downloads`, y acceso únicamente a
`https://prod2.seace.gob.pe/*`. No pide `cookies`, acceso a todos los sitios ni
permisos para leer el historial de pestañas de otros dominios. Solo recibe órdenes
externas de `/admin/descargas` en el portal configurado (o localhost:3000 en desarrollo).
La clave pública del manifest fija su ID; no es una credencial. Otro dominio del
portal requiere ajustar la lista de orígenes permitidos y reinstalar el paquete.

El endpoint `/api/admin/descargas-seace/extension` exige `imports:write`, sirve un
ZIP sin caché compartida e incluye el código local, SheetJS ya fijado por el proyecto
y su licencia. No descarga código de un CDN durante la ejecución. El tracing de Next
incluye esos archivos en el despliegue. No cambia las variables de entorno.

Los libros no se envían a Render, no se importan automáticamente y no se alteran
sus montos ni filas. Subirlos después al importador para revisar y confirmar.

## Evidencia y límites de la verificación

Render recibió HTTP 403 al abrir SEACE, mientras que el navegador del usuario
exportó con HTTP 200. Tres Excel entregados por el administrador eran idénticos
byte por byte y contenían las 386 órdenes de diciembre de 2018. Abrir doce pestañas
mostraba meses diferentes pero exportaba diciembre; consultar uno por vez sí
funcionaba. Se retiraron la apertura paralela y el recorrido manual de confirmaciones.

Las pruebas ejecutan el código de la extensión y la función inyectada en un entorno
simulado: doce Excel BIFF8, navegación serial, `ViewState` nuevo, hashes originales,
espera de descarga completa, error HTTP, interrupción y rechazo de diciembre al
solicitar enero. Verifican también el ZIP, el ID y los permisos, y la autorización
para obtener el paquete. No se ha probado una descarga completa en una sesión real
de SEACE; necesita comprobarse en el Chrome del administrador. Si SEACE exige una
verificación, el proceso se detiene; no evade CAPTCHA ni desactiva protecciones.
