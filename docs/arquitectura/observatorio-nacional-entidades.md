# Evolución a un observatorio nacional de contrataciones públicas

## Objetivo

Ampliar Fiscalizador desde la comparación de municipalidades hasta las contrataciones registradas por entidades públicas de todo el Perú: gobiernos locales y regionales, UGEL, redes y establecimientos de salud, EPS, proyectos especiales, universidades y otras entidades contratantes.

El alcance inicial sigue siendo **órdenes de compra y servicio**. “Todas las entidades” significa todas las entidades que puedan identificarse y sustentarse en las fuentes configuradas, no que el portal ya cubra cada modalidad de gasto, contrato o registro público.

## Hallazgo del repositorio

La base ya tiene una columna `entityType` en `Municipality`, y `ImportBatch` y `Order` se aíslan por `municipalityId`. `Supplier` se identifica globalmente y sus órdenes pueden cruzarse entre entidades. Esto ofrece un punto de partida bueno para extender el producto sin duplicar proveedores ni reimportar toda la historia.

La capa actual sigue siendo municipal en nombres y supuestos: modelos, servicios, rutas, selectores y administración hablan de municipalidades; el tipo significa principalmente distrital/provincial/centro poblado; departamento y provincia tienen valores por defecto Junín/Chanchamayo; algunas estadísticas comparan gestiones municipales. No se debe exponer esos mismos análisis como si fueran apropiados para hospitales, EPS o UGEL.

## Decisiones de arquitectura

1. Introducir el concepto de **Entidad Pública** en el dominio y la interfaz. En la primera migración se conserva la tabla y los identificadores actuales; las órdenes, proveedores, importaciones y URLs existentes siguen funcionando. El eventual renombrado físico de tablas/columnas se deja para cuando todos los consumidores estén migrados.
2. Añadir una categoría controlada pero extensible: municipalidad, gobierno regional, gobierno nacional, UGEL/educación, red/hospital/salud, empresa pública/EPS, proyecto especial, universidad y otras. Mantener separado el nivel territorial municipal que hoy se guarda en `entityType`.
3. Incorporar código oficial de entidad, sector, identificador RUC, ubicación opcional y relación jerárquica opcional (por ejemplo, establecimiento → red → gobierno regional). Validar RUC y códigos contra el padrón de origen y evitar deducir jerarquías de nombres parecidos.
4. Conservar el aislamiento por entidad para importar, revisar, reemplazar versiones y borrar. Las identidades de proveedor siguen globales por RUC para permitir cruces; cada orden conserva su entidad y fuente.
5. Usar un registro de fuentes y adaptadores versionados. Cada adaptador documenta formato, campos, clave de orden, fechas de cobertura, periodicidad y calidad. Un libro local de EPS/UGEL/Proyecto Pichis Palcazú puede cargarse por separado con su fuente y mapeo; los datos no se etiquetan como cobertura nacional si provienen de un libro aislado.
6. Mantener trazabilidad: lote, nombre del archivo, entidad, fuente/URL, periodo, versión, checksum, observaciones y fecha de consulta. El original puede conservarse cuando está disponible y autorizado/configurado; la aplicación no debe depender de guardar todos los Excel para consultar datos estructurados.
7. Hacer explícita la cobertura: fuente, primer/último periodo, meses faltantes, última actualización y si la carga es oficial, manual o parcial. Los montos representan órdenes registradas; no acreditan pagos.

## Fuentes y cobertura

El Portal de Datos Abiertos del OECE expone una tabla maestra de entidades contratantes SEACE. Su conjunto de órdenes de compra/servicio cubre las entidades registradas desde 2018 y se actualiza mensualmente. Esta debe ser la vía nacional prioritaria, previa revisión del diccionario, identificadores, tamaño y calidad de los archivos. Los libros originales ya descargados por el administrador complementan periodos/formats anteriores o faltantes, con cobertura etiquetada por entidad y mes.

La información adjudicada, contratos, PAC, sanciones/RNP u otros conjuntos no se mezclarán automáticamente con órdenes: son fuentes y conceptos distintos, candidatos a adaptadores posteriores. Registrar fuente no equivale a afirmar que existe cobertura completa o que dos conjuntos son directamente sumables.

## Plan de implementación

### Fase 0 — Inventario y línea base

- Enumerar consultas, rutas, estadísticas, comparadores y procesos de borrado que filtran por municipalidad.
- Inventariar formatos reales ya disponibles para EPS Selva Central, UGEL Chanchamayo y Proyecto Especial Pichis Palcazú; documentar encabezados y llaves sin subir archivos a un proveedor externo.
- Descargar el padrón y diccionario oficiales OECE, confirmar tamaño/campos y producir una muestra de mapeo. Probar localmente, sin base de producción.
- Definir una entidad piloto y criterios de aceptación con una muestra pequeña.

### Fase 1 — Catálogo nacional y administración

- Agregar categoría, sector, código oficial, geografía opcional y jerarquía.
- Convertir “Municipalidades” en “Entidades públicas” en el panel; permitir búsqueda por nombre/RUC, filtros sector/departamento/provincia y alta/edición con validación.
- Incorporar catálogo oficial en una operación idempotente que actualice metadatos sin borrar órdenes, perfiles, branding ni fuentes ya asignadas.
- Mantener San Ramón como entidad predeterminada y las URLs actuales.

### Fase 2 — Importador multi-formato seguro

- Separar detectar entidad/fuente, mapear columnas, interpretar filas y reconciliar órdenes en adaptadores.
- Mantener el flujo actual de confirmar duplicados/observaciones.
- Procesar archivos grandes en lotes acotados, con tope de bytes/filas y medición de memoria; no leer 200 libros completos simultáneamente en el proceso web de 512 MB.
- Empezar con: libro SEACE local actual; padrón OECE; órdenes OECE; y plantillas verificadas de EPS, UGEL y proyecto especial.
- La importación masiva conserva progreso, reintentos idempotentes y separación por entidad; no depende de Redis.

### Fase 3 — Búsqueda global y páginas de entidad

- La búsqueda global encuentra un proveedor por nombre/RUC en todas las entidades cargadas y agrupa resultados por entidad, periodos, cantidad de órdenes y monto considerado.
- Al navegar desde la página de una entidad, perfiles y órdenes quedan filtrados a esa entidad. El perfil global puede mostrar el cruce completo con vínculos claros entre resultados.
- La página de entidad muestra su tipo, ubicación, fuentes y cobertura; ofrece el conjunto de estadísticas adecuado a su sector.
- El selector deja de ser una lista plana enorme: buscar entidad y filtrar por sector/territorio.

### Fase 4 — Estadísticas por sector

- Reutilizar indicadores transversales (montos considerados, órdenes, concentración, RUC 10/20, evolución y cobertura).
- Mantener comparaciones de gestiones políticas únicamente para municipalidades/gobiernos regionales y con periodos definidos.
- No aplicar categorías de alimentación, prensa o aniversario municipal a una UGEL, hospital o EPS sin clasificación y evidencia apropiadas. Crear taxonomías por sector y permitir revisión manual de categorías dudosas.

### Fase 5 — Despliegue gradual

- Piloto con Chanchamayo en tres clases: UGEL, EPS y proyecto especial, además de San Ramón ya existente.
- Contrastar por RUC, número de órdenes, fecha y montos con cada fuente original; revisar duplicados entre versiones y aislamiento de datos.
- Importar luego el catálogo y los meses OECE en lotes progresivos, mostrando cobertura real. Mantener activación de entidades por lotes y reversión de una carga sin tocar otras.
- Expandir a nivel nacional después de validar rendimiento en Render y Neon gratuitos.

## Pruebas de aceptación

- Una orden nunca aparece bajo entidad equivocada; el RUC/RUC proveedor no cambia entre entidades.
- Importar o eliminar una entidad no altera órdenes, fotos, perfiles ni lotes de otra.
- Reimportar una versión deja una sola instantánea vigente por entidad, fuente, periodo y tipo.
- La búsqueda global agrupa al proveedor entre entidades y sus enlaces de perfil conservan el filtro local.
- Cobertura incompleta queda visible y no se interpreta como ausencia de contrataciones.
- Archivos grandes no se cargan todos a memoria; el proceso se interrumpe con mensaje claro antes de afectar el servicio.
- Los totales coinciden con la muestra oficial/manual de origen y las estadísticas sectoriales no mezclan categorías incompatibles.

## Fuentes oficiales consultadas

- OECE, acceso al Portal de Datos Abiertos: https://www.gob.pe/es/14272-acceder-al-portal-de-datos-abiertos-del-oece
- Catálogo OECE/SEACE, conjuntos de datos abiertos y entidades contratantes: https://bi.seace.gob.pe/pentaho/api/repos/%3Apublic%3Aportal%3Adatosabiertos.html/content?password=key&userid=public
- OECE, órdenes de compra y/o servicios: https://bi.seace.gob.pe/pentaho/api/repos/%3Apublic%3Aportal%3Adatosabiertosordenes.html/content?password=key&userid=public
- Catálogo Nacional de Datos Abiertos, entidades contratantes: https://datosabiertos.gob.pe/dataset/entidades-contratantes-organismo-supervisor-de-las-contrataciones-del-estado-osce-0

El contenido y la periodicidad de las fuentes pueden cambiar; verificar el catálogo y sus diccionarios en cada actualización del adaptador.
