# Conexiones del administrador con el portal

Revisión del código: 8 de octubre de 2026. No verifica el estado de las fotos almacenadas ni las variables del despliegue de producción.

| Elemento | Conexión y actualización |
| --- | --- |
| Foto del proveedor / prensa | SupplierProfile y Cloudinary. Publicación explícita con fuente opcional, reutilización de fotos ya guardadas, URL versionada y revalidación del portal. Las personas del listado con proveedor registrado pueden mostrar foto aunque no tengan órdenes vigentes. |
| Datos de proveedor | Nacimiento, edad, DNI, distrito, notas y vínculos leen la ficha administrativa y sus controles de publicación. Guardar refresca también ranking y prensa. |
| Personas y vínculos | Datos de la base. Sus acciones administrativas revalidan el portal. |
| Apariencia e imágenes | Logo, favicon, portada, imagen social y titulares leen AppSetting; guardar revalida el layout público. |
| Órdenes y estadísticas | Importaciones confirmadas y versiones vigentes; no cifras escritas manualmente en las tarjetas. |

## Fotos que se subieron antes de la corrección

El código anterior desactivaba la publicación de la foto al subirla y borraba su fuente. Esta corrección no publica automáticamente registros privados ni inventa una fuente para ellos. En Administrador → Proveedores → ficha, la sección Foto muestra su estado. Marca «Mostrar foto en el portal» y pulsa «Guardar foto / publicación». Puedes dejar el archivo vacío para publicar la imagen existente. No se exige fuente para subir o publicar fotos; puedes añadirla si dispones de ella.

## Configuración que sigue en archivos del proyecto

- Las identidades del listado de prensa y su prioridad están en `data/prensa.json` y `lib/prensa.ts`; no hay editor de ese listado en el administrador. Las fotos y los perfiles sí se editan allí.
- Las categorías de gasto y sus palabras de clasificación están en `lib/categorias-gasto.ts`; no hay editor administrativo de esas reglas.
- Algunos rótulos y la ubicación meteorológica siguen específicos de San Ramón. Cambiar el nombre municipal en Apariencia no configura por sí solo otra localidad.

Los cambios en una pestaña pública que ya permanece abierta se ven al recargar o volver a visitarla; no se ha añadido sincronización en tiempo real entre pestañas.
