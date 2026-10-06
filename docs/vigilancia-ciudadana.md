# Mejoras para vigilancia ciudadana

## Universo y versiones

Cada importación confirmada guarda una instantánea completa. Solo los libros `isCurrent` participan en las cifras públicas; la vista PostgreSQL `CurrentOrder` y los filtros Prisma aplican este universo. Las versiones históricas y sus originales se conservan. Una sustitución exige confirmación y bloquea el periodo dentro de la transacción para serializar OC, OS y consolidado. Un consolidado puede sustituir ambos libros; un libro OC/OS no sustituye un consolidado porque perdería la otra parte.

La migración es aditiva y transaccional. Activa libros antiguos sin conflictos; los periodos con versiones potencialmente incrementales quedan pendientes de revisión, excluidos del agregado y visibles en Fuentes y cobertura y en el aviso de portada. Para resolverlos, importar el libro completo nuevamente. No se elige automáticamente el último lote antiguo.

## Cifras y cobertura

Los montos son órdenes registradas o consideradas por el catálogo, no pagos efectivos ni presupuesto municipal. Los agregados y promedios se formatean con Decimal sin convertir a coma flotante, para conservar céntimos incluso en sumas grandes. Los promedios excluyen anuladas, estados no considerados y montos desconocidos. El conteo paginado del ranking utiliza la misma gestión y proveedores con órdenes vigentes que su consulta de filas. Los estados no anulados se presentan con estilo neutro.

La cobertura usa año/mes/tipo del libro, no meses inferidos de fechas de órdenes. Cada año con libros tiene un calendario OC/OS de doce meses. «Completo declarado» requiere declaración administrativa y ausencia de errores/exclusiones; no constituye una auditoría independiente de la fuente. La ausencia no se interpreta como gasto cero. Las comparaciones advierten sobre coberturas diferentes; no se calcula un ranking de eficiencia municipal.

## Evidencia pública

`/ordenes/[id]` enlaza la orden a su libro, hoja, fila física y SHA-256 del original. Los índices incluyen huecos iniciales e intermedios. Las referencias de fila antiguas sin hoja registrada se presentan como pendientes de revalidar. `/fuentes` reúne originales enlazados, calidad y versiones. `/api/public/libros/[id]` exporta un extracto CSV normalizado, con restricciones de visibilidad globales y del lote y protección contra fórmulas de hoja de cálculo. El extracto no sustituye el original. Exportaciones superiores a 20.000 filas devuelven un error explícito; no se truncan silenciosamente.

No se publican automáticamente columnas arbitrarias, `rawData`, claves de almacenamiento ni identidad del administrador. El enlace por ID referencia una versión concreta aunque aparezca otra corregida. Las nuevas importaciones permiten documentar la URL de origen. Falta aportar enlaces para los libros existentes que no los tengan.

## Relaciones documentadas

Una relación manual exige descripción y URL de evidencia propia; admite inicio/fin documentados y fecha de revisión editorial. Las relaciones antiguas sin evidencia quedan disponibles en administración y excluidas del portal público hasta documentarlas nuevamente. La coincidencia RUC/DNI se presenta como coincidencia de identificadores, no como prueba de relación política o irregularidad. Los importes representan todo el proveedor en los libros vigentes, sin atribuirlos a una persona ni al periodo del vínculo. Cambiar la afirmación o fuente de una ficha pública renueva su fecha editorial.

## Configuración y verificación

Configurar `NEXT_PUBLIC_MUNICIPALIDAD` con el nombre oficial y el contacto existente de correcciones. No se infiere qué municipalidad se está vigilando.

Las pruebas de regresión cubren fila física con huecos, identidad OC/OS, correcciones de monto/estado sin acumular versiones, promedio, ranking por gestión, exportación, restricciones de visibilidad y fórmulas CSV, consentimiento de sustitución y ocultación de relaciones sin evidencia. Los fixtures PostgreSQL son independientes del libro de referencia y limpian sus datos. El CI ejecuta migraciones, catálogos, pruebas con cobertura y compilación. La revisión de datos y fuentes en producción sigue siendo necesaria antes de adoptar el cambio.
