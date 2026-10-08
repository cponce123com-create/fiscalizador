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

- No es una cola distribuida: si el proceso se apaga durante el análisis, el
  usuario debe volver a subir el libro.
- Sigue existiendo el límite de 25 MB por archivo.
- Si algún día hay varias importaciones simultáneas o archivos mucho mayores,
  recién conviene evaluar una cola persistente.

## Validación operativa

1. Subir un libro mensual normal y confirmar que la vista previa aparece.
2. Subir un libro grande dentro del límite y comprobar que el portal público
   sigue respondiendo durante el análisis.
3. Revisar logs: si el worker termina con error, la respuesta debe mostrar un
   mensaje de negocio y no dejar datos importados.
