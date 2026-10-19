# Catálogo nacional de entidades OECE

## Alcance de esta fase

El catálogo OECE se guarda en `OeceCatalogEntry`, separado de `Municipality` (modelo legado usado por órdenes e importaciones). Una sincronización solo crea o actualiza candidatos. No activa entidades, no importa libros ni órdenes y nunca desactiva o elimina registros ausentes de una descarga.

Esto evita que miles de entidades aparezcan automáticamente en el selector público o que se mezclen datos de distintas fuentes. La promoción al portal sigue siendo una decisión administrativa usando categoría, ubicación, RUC y código oficial verificados.

## Sincronizar

1. Aplicar migraciones en el entorno de desarrollo con `npm run db:deploy`.
2. Confirmar `DIRECT_URL` y `DATABASE_URL` contra una base de desarrollo, no producción.
3. Ejecutar `npm run catalogo:oece` para descargar y validar una vista previa. No escribe en la base de datos.
4. Revisar el número de filas y la fecha máxima `ULTIMAACTUALIZACION` que informa el proceso.
5. Solo tras verificar que la conexión apunta al entorno deseado, ejecutar `npm run catalogo:oece -- --apply` para guardar candidatos.

La fuente se puede sustituir mediante `OECE_CATALOG_URL`. La descarga tiene un límite de 2 MB, tiempo máximo de 30 segundos y validaciones de estructura, mínimo de filas, RUC/código duplicados y datos obligatorios. Las escrituras ocurren en lotes de 100.

## Vigencia de la fuente

El enlace público utilizado por OECE es `https://tinyurl.com/CONOSCEENTIDADCONTRATANEW`. En la revisión del 19 de octubre de 2026, el archivo accesible contenía 3,340 filas y su actualización más reciente declarada era `26/02/25`. Por eso la sincronización advierte cuando el dato más reciente tiene más de 180 días. La hora de descarga no se presenta como fecha de actualización del padrón.

No se debe usar la ausencia de una entidad en esta versión como evidencia de que no existe. Antes de promover entidades a `Municipality`, confirmar el RUC, el estado y el código con la ficha o fuente oficial vigente. Mantener en especial el registro manual de entidades públicas que no estén en el padrón descargado.

## Siguiente fase

- Crear una interfaz administrativa paginada para buscar candidatos y revisar su fecha/estado.
- Promover entidades seleccionadas con controles de RUC único, categoría y jerarquía.
- Incorporar una fuente vigente para órdenes de compra/servicio, procesada por entidad y periodo en lotes; no derivar las órdenes del padrón de entidades.
- Añadir seguimiento de cobertura y procedencia por entidad, fuente y periodo.
