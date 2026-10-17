# Importación sin Redis

El análisis inicial de Excel usa `node:worker_threads` para leer el libro fuera
del hilo principal de Next.js. Es una alternativa gratuita a BullMQ/Redis para el
tamaño actual del proyecto.

## Qué resuelve

- `XLSX.read` sigue siendo síncrono, pero corre en un worker local.
- El proceso web puede seguir atendiendo páginas públicas mientras se interpreta
  un libro pesado.
- No requiere Upstash, Redis, cuenta externa ni un worker de pago.

## Límites

- No es una cola distribuida: si el proceso se apaga antes de terminar el análisis
  y guardar el original, el usuario debe volver a subir el libro. Una vez creado el
  lote `VALIDATING`, el panel permite recuperar el análisis desde el original
  guardado; las decisiones de revisión se deben repetir.
- Se admiten hasta 200 libros por tanda y 10 MB por archivo. La tanda la orquesta
  el navegador y cada libro se analiza/confirma de manera independiente.
- Si algún día hay varias importaciones simultáneas o archivos mucho mayores,
  recién conviene evaluar una cola persistente.

## Validación operativa

1. Subir un libro mensual normal y confirmar que la vista previa aparece.
2. Subir un libro grande dentro del límite y comprobar que el portal público
   sigue respondiendo durante el análisis.
3. Revisar logs: si el worker termina con error, la respuesta debe mostrar un
   mensaje de negocio y no dejar datos importados.
