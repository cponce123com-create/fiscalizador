# Descarga anual desde el administrador

En **Admin → Descargas SEACE**, elegir un año y pulsar **Descargar los 12 libros**.
Se consulta enero a diciembre en orden, mostrando los meses descargados y los errores.
Al completar los doce, el navegador inicia la descarga del ZIP. El botón ZIP permite volver
a descargarlo; si falta algún mes, se ofrece explícitamente un ZIP parcial.

Los Excel originales se guardan sin modificar, con nombre `Ordenes-y-servicios-2015-01-Municipalidad-Distrital-de-San-Ramon.xls`
(o `.xlsx`), SHA-256 y un resumen en el ZIP. Descargar **no crea importaciones ni órdenes**.
Para incorporar datos, subir después los libros en Importar y confirmar su análisis.
Las descargas son privadas por usuario y requieren `imports:write`.

## Conectar el navegador al portal

El servicio Node actual de Render no incluye un navegador. Se entrega un worker separado,
sin conectarse a Neon ni usar las credenciales del administrador. **El PR no despliega
este servicio ni contrata un plan.**

1. Crear un servicio Docker privado con el repositorio, raíz `scrapers` y Dockerfile
   `Dockerfile.seace-worker`; puerto 8080. Si se publica en otro host, usar HTTPS.
2. Generar un secreto independiente, por ejemplo `openssl rand -hex 32`, y definir
   `SEACE_WORKER_TOKEN` en ambos servicios. Nunca usar una variable `NEXT_PUBLIC_*`.
3. En el servicio web fiscalizador definir:

   ```dotenv
   SEACE_WORKER_URL=http://HOST-PRIVADO.internal:8080/
   SEACE_WORKER_TOKEN=EL-MISMO-SECRETO-DEL-WORKER
   ```

4. Reiniciar el portal y probar **un mes** con datos conocidos antes de descargar un año.
   Comparar el Excel con la descarga manual y comprobar el nombre del botón real.
   Si hace falta, definir `SEACE_EXCEL_SELECTOR` **solo en el worker** con su selector CSS verificado.

El contenedor ejecuta Chromium como `pwuser` con sandbox activado. El host necesita
soportar los espacios de nombres y permisos de sandbox recomendados por Playwright:
https://playwright.dev/python/docs/docker. Si Render no los permite, alojar el worker
en un host compatible; no desactivar el sandbox para ocultar el fallo.
La imagen de Playwright y la dependencia Python están fijadas a la misma versión 1.63.0.

## Almacenamiento y reintentos

El staging se guarda en una carpeta `descargas-seace` junto a `STORAGE_LOCAL_DIR`:
con `/var/data/uploads`, queda en `/var/data/descargas-seace`, dentro del disco persistente.
Máximo 25 MB por libro, dos descargas anuales globales y una por usuario.
Reservar hasta 600 MB adicionales y ampliar el disco si las importaciones ya lo ocupan.
Caducan a las 24 horas; el staging caducado se limpia al iniciar otra descarga.
El botón Eliminar descarga temporal libera espacio sin tocar las importaciones.

La descarga se ejecuta mes a mes desde el panel: mantener la pestaña abierta.
Pausar espera a terminar el mes actual. Cerrar la pestaña detiene la secuencia; al volver
se recupera el progreso guardado y Continuar omite los meses completos.
Las peticiones de mes tienen un máximo de 100 segundos; no hay una petición que espere los doce.
El ZIP se transmite como flujo, sin cargar los doce Excel a la vez en memoria.

## Límite de la verificación real

Durante el desarrollo, SEACE devolvió HTTP 403 y el navegador disponible no pudo acceder.
Por ello **no se ha verificado el selector real ni una descarga completa contra SEACE**.
Las pruebas usan Excel originales de referencia y un worker simulado.
El worker no evade WAF ni resuelve CAPTCHA. Un 403, CAPTCHA, botón ambiguo o archivo inválido
se marca como error; nunca se registra como libro descargado ni como mes sin gastos.
Si SEACE exige intervención manual en el host elegido, usar la herramienta local documentada
en `scrapers/README.md`; esa restricción impide garantizar doce descargas automáticas.
