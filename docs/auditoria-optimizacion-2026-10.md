# Auditoría técnica y optimización — octubre de 2026

## Resumen ejecutivo

Se contrastó el plan maestro con el código actual. Varias recomendaciones ya
estaban implementadas: límite de 200 libros, procesamiento de Excel en worker,
estados persistentes de importación, recuperación de procesos caducados,
reclamación atómica, control de duplicados, filtro municipal de prensa,
Playwright, Lighthouse y escenarios k6 protegidos contra producción.

Los dos hallazgos críticos que sí continuaban presentes eran:

1. `render.yaml` declaraba `plan: starter`, disco y `preDeployCommand`, aunque la
   operación requerida es Render Free.
2. `STORAGE_DRIVER=cloudinary` terminaba en un error deliberado. Los libros
   dependían del disco local efímero.

Esta fase implementa almacenamiento Cloudinary RAW autenticado, alinea el
Blueprint con Render Free, unifica el límite de archivos con la cuota gratuita
de Cloudinary e incorpora una caché LRU breve para búsquedas globales repetidas.

La revisión V4 posterior añadió una verificación real, optativa y segura del
circuito Cloudinary, corrigió documentación operativa obsoleta y convirtió la
exportación CSV a lectura paginada y entrega progresiva. También se confirmó que
la importación ya posee reclamación atómica, estados persistentes y recuperación
de procesos caducados; no se duplicó esa arquitectura con otra cola.

## Matriz de cambios

| ID | Causa verificada | Solución | Prueba |
| --- | --- | --- | --- |
| ALM-01 | El driver Cloudinary de libros no existía | Adaptador RAW autenticado con claves validadas, lectura, existencia, verificación SHA-256 y eliminación | `storageService.test.ts` |
| ALM-02 | Render Free no conserva el sistema de archivos | `STORAGE_DRIVER=cloudinary`; se elimina el disco del Blueprint | Revisión de `render.yaml` y typecheck |
| DES-01 | Blueprint pedía plan Starter y pre-deploy pagado | `plan: free`; migración idempotente mediante el único script de arranque | Validación YAML/manual |
| IMP-01 | UI/API aceptaban 25 MB pero Cloudinary Free admite RAW de 10 MB | Constantes compartidas de 10 MB en cliente y API | Typecheck y pruebas existentes del importador |
| BUS-01 | Consultas globales idénticas repetían SQL durante la escritura | Caché LRU de 30 segundos, máximo 100 claves | Prueba de reutilización e invalidación |
| BUS-02 | Una importación o borrado podía dejar caché obsoleta | Invalidación después de confirmar o eliminar lotes | Pruebas de importación y búsqueda |
| ALM-03 | Solo había simulaciones unitarias del almacenamiento remoto | `npm run verify:cloudinary` crea un XLSX temporal, verifica tamaño/SHA/existencia/descarga y elimina únicamente ese recurso | Preparada; ejecución real pendiente de credenciales |
| DOC-01 | README y operación todavía afirmaban que los originales vivían en disco | Documentación alineada con Cloudinary RAW autenticado | Revisión de documentación |
| EXP-01 | El CSV acumulaba hasta 20.000 objetos y dos representaciones completas | Cursor de 500 filas y `ReadableStream`; XLSX conserva su límite y ruta separada | Typecheck y 24 pruebas focalizadas |

## Integridad y seguridad

- Solo se aceptan `.xls`, `.xlsx` y `.csv`.
- El `public_id` remoto se genera en el servidor con UUID y extensión validada.
- Los originales se suben con entrega `authenticated`, no pública.
- Las credenciales nunca se envían al navegador.
- La clave almacenada tiene un formato estricto y no acepta rutas arbitrarias.
- La descarga pública conserva la comprobación SHA-256 existente.
- La eliminación masiva sigue comprobando que una clave no esté compartida por
  otro lote antes de retirar el recurso.
- No se añadieron migraciones destructivas ni se tocaron datos reales.

## Compatibilidad gratuita

- Render Free: no usa disco, background worker ni `preDeployCommand`.
- Neon Free: no se añade otra base ni más conexiones permanentes.
- Cloudinary Free: los originales usan recursos RAW; el límite de aplicación se
  alinea con el máximo RAW de 10 MB. Debe vigilarse el consumo conjunto de
  almacenamiento y ancho de banda en el panel de Cloudinary.
- No se añade Redis ni otra dependencia.

Referencias operativas:

- [Cloudinary: archivos RAW y tipos de entrega](https://cloudinary.com/documentation/upload_parameters)
- [Cloudinary: límites por plan](https://cloudinary.com/pricing/compare-plans)
- [Render Free y sistema de archivos efímero](https://render.com/docs/free)

## Validación ejecutada

- TypeScript: correcto.
- ESLint: correcto.
- Vitest completo: 77 archivos aprobados, 10 omitidos; 621 pruebas aprobadas y
  165 omitidas.
- Pruebas focalizadas de almacenamiento, importación, borrado y búsqueda: 38
  aprobadas y 21 omitidas.
- Revisión V4: 24 pruebas focalizadas de almacenamiento y exportación aprobadas.
- La integración Cloudinary quedó preparada, pero no se ejecutó porque este
  entorno no dispone de credenciales; el comando terminó antes de hacer red.
- No se ejecutó carga k6 ni `EXPLAIN ANALYZE` contra producción.

## Evaluación por área

Estas notas reflejan el código verificable, no la disponibilidad futura de
servicios externos.

| Área | Nota | Observación |
| --- | ---: | --- |
| Arquitectura | 8.4 | Capas claras; falta desacoplar más trabajos largos. |
| Next.js | 8.5 | Buen uso de rutas y Server Components. |
| React | 8.3 | Estados de importación amplios; aún hay componentes extensos. |
| TypeScript | 9.0 | Modo estricto y typecheck limpio. |
| Prisma | 8.6 | Singleton, selección y SQL parametrizado. |
| PostgreSQL | 8.5 | Índices trigram/FTS; falta medir planes en una copia grande. |
| Búsqueda global | 8.7 | Prioridad por identidad y caché acotada. |
| Búsqueda de órdenes | 9.0 | Búsqueda híbrida e índice GIN. |
| Importación masiva | 8.6 | 200 archivos, worker y recuperación por lote. |
| Almacenamiento | 8.8 | Persistencia remota y prueba controlada preparadas; falta ejecutar con credenciales y reconciliar históricos. |
| Seguridad | 8.7 | Roles, 2FA, validaciones y límites; rate limit es por proceso. |
| Autenticación | 9.0 | Controles sólidos y pruebas. |
| Autorizaciones | 8.8 | Permisos y ámbito municipal presentes. |
| Administración | 8.4 | Funcional; conviene dividir pantallas muy grandes. |
| Municipalidad y cobertura | 8.8 | Contexto municipal consistente. |
| Proveedores | 8.7 | Perfiles y resúmenes bien integrados. |
| Perfiles | 8.6 | Publicación granular y trazabilidad. |
| Prensa | 8.5 | Cruce por RUC y clasificación por contenido con filtro municipal. |
| Estadísticas | 8.7 | Paneles pesados se transmiten progresivamente; falta medición con volúmenes extremos. |
| Rankings | 8.6 | Segmentación municipal, gestión y tipo de RUC. |
| Exportaciones | 8.4 | CSV paginado/streaming y protección de fórmulas; XLSX aún se construye en memoria. |
| Interfaz móvil | 8.7 | Navegación estadística táctil, carga estable y cambio municipal optimista; falta matriz visual completa. |
| Accesibilidad | 8.3 | Etiquetas y foco visibles; Lighthouse debe ejecutarse desplegado. |
| Rendimiento | 8.2 | Mejoras SQL/caché; faltan datos p50/p95 de una base aislada. |
| Caché | 8.1 | Next.js más LRU local; no es compartida entre instancias. |
| Pruebas | 8.9 | 621 aprobadas y Playwright configurado. |
| Despliegue | 8.5 | Blueprint compatible con Free; vigilar arranque en frío. |
| Mantenimiento | 8.5 | Documentación y constantes compartidas. |
| Escalabilidad | 7.8 | Adecuada para una instancia; no garantiza procesamiento sin servidor activo. |
| Integridad de datos | 9.0 | SHA-256, duplicados, versiones y transacciones. |

**Puntuación general estimada: 8.7/10.** No se eleva artificialmente a 9 mientras
falten mediciones contra una base aislada grande y la ejecución externa controlada.

## Pendientes legítimos

1. Ejecutar `EXPLAIN (ANALYZE, BUFFERS)` y k6 únicamente sobre una rama de Neon
   aislada con datos anonimizados y volúmenes representativos.
2. La exportación XLSX sigue requiriendo memoria porque la librería actual no
   ofrece escritura progresiva; el CSV ya usa páginas y streaming.
3. Añadir reconciliación administrativa de metadatos contra Cloudinary y mostrar
   originales faltantes o corruptos.
4. Ejecutar Playwright y Lighthouse con Chromium en CI o en un entorno de prueba.
5. Si algún día se usan varias instancias, mover el rate limiting a una capa
   compartida; no es necesario ni gratuito para la instancia actual.
