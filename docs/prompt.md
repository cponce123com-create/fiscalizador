Quiero construir una aplicación web profesional, escalable, modular, rápida y ligera para consultar y analizar información pública de órdenes de compra y órdenes de servicio obtenidas del Portal de Transparencia.

La aplicación debe funcionar como un portal ciudadano de transparencia y análisis de gasto público.

NO quiero una aplicación que simplemente muestre archivos Excel.

Quiero que los archivos Excel/XLS/XLSX/CSV sean utilizados como FUENTE DE IMPORTACIÓN y que posteriormente los datos sean normalizados, almacenados y consultables desde PostgreSQL mediante Prisma.

==================================================

1. STACK TECNOLÓGICO
   ==================================================

Utilizar:

* Next.js
* TypeScript
* React
* Tailwind CSS
* shadcn/ui
* Prisma ORM
* PostgreSQL
* Neon PostgreSQL
* Render para despliegue
* Cloudinary para fotografías, imágenes y archivos cuando corresponda
* TanStack Table para tablas avanzadas
* Recharts para gráficos
* Zod para validación
* Lucide Icons
* Sistema de autenticación seguro
* Variables de entorno para secretos

La arquitectura debe permitir crecer posteriormente sin necesidad de reescribir la aplicación.

Debe estar preparada para manejar varios años de información y cientos de miles o millones de registros.

==================================================
2. ARQUITECTURA GENERAL
=======================

Crear dos áreas completamente diferenciadas:

A. FRONTEND PÚBLICO

Para cualquier ciudadano.

B. PANEL ADMINISTRATIVO

Para usuarios autorizados.

Arquitectura:

Frontend público
↓
API / Server Actions
↓
Prisma
↓
Neon PostgreSQL

Administrador
↓
Importador
↓
Validación
↓
Normalización
↓
PostgreSQL

Cloudinary:

* fotografías de proveedores
* imágenes
* archivos originales cuando corresponda

==================================================
3. OBJETIVO PRINCIPAL
=====================

La aplicación permitirá importar libros mensuales descargados del Portal de Transparencia.

Por ejemplo:

2025

* Enero
* Febrero
* Marzo
* Abril
* Mayo
* Junio
* Julio
* Agosto
* Septiembre
* Octubre
* Noviembre
* Diciembre

El administrador debe poder subir uno o varios archivos correspondientes a diferentes meses.

La aplicación debe detectar automáticamente las columnas y permitir al administrador revisar la información antes de confirmar la importación.

==================================================
4. ARCHIVO DE REFERENCIA
========================

El archivo de referencia contiene columnas similares a:

* N°
* Tipo de Orden
* Número de orden
* Tipo de Contratación
* Descripción y Finalidad de la contratación
* Nro. Exp. SIAF
* Fecha de Emisión
* Fecha de Compromiso
* Estado
* Monto
* RUC
* Denominación o razón Social

NO asumir que los próximos archivos tendrán exactamente las mismas columnas.

El sistema debe ser resistente a cambios en nombres, orden y cantidad de columnas.

==================================================
5. IMPORTADOR INTELIGENTE
=========================

Crear un módulo de importación.

Flujo:

1. Administrador selecciona año.
2. Selecciona mes.
3. Selecciona tipo de información.
4. Sube XLS/XLSX/CSV.
5. Sistema detecta automáticamente encabezados.
6. Sistema muestra columnas encontradas.
7. Sistema intenta mapearlas a campos internos.
8. Sistema muestra vista previa.
9. Sistema valida datos.
10. Sistema detecta errores.
11. Sistema detecta posibles duplicados.
12. Sistema detecta proveedores.
13. Sistema detecta RUC.
14. Sistema detecta estados anulados.
15. Sistema muestra resumen.
16. Administrador confirma.
17. Sistema procesa.
18. Sistema guarda ImportBatch.
19. Sistema registra todos los registros.
20. Sistema genera estadísticas.

Nunca insertar directamente sin mostrar una etapa de validación.

==================================================
6. COLUMNAS CONFIGURABLES
=========================

El administrador debe poder ver todas las columnas detectadas.

Ejemplo:

Columna | Detectada | Pública

N°
Tipo de Orden
Número de orden
Tipo de contratación
Descripción
SIAF
Fecha de emisión
Fecha de compromiso
Estado
Monto
RUC
Razón social

Cada columna debe tener:

* nombre original
* nombre interno
* tipo de dato
* visible públicamente
* obligatoria
* descripción

El administrador debe poder activar/desactivar la visibilidad pública.

IMPORTANTE:

Desactivar una columna NO debe eliminarla de la base de datos.

La información original siempre debe conservarse.

==================================================
7. IMPORT BATCH
===============

Crear entidad ImportBatch.

Debe registrar:

* id
* filename
* originalFilename
* year
* month
* period
* uploadedBy
* uploadedAt
* status
* totalRows
* successfulRows
* warningRows
* errorRows
* checksum
* originalFileUrl
* processingStartedAt
* processingFinishedAt

Estados:

UPLOADED
VALIDATING
PROCESSING
COMPLETED
COMPLETED_WITH_WARNINGS
FAILED

==================================================
8. PREVENCIÓN DE DUPLICADOS
===========================

Si el administrador intenta importar nuevamente el mismo periodo, mostrar advertencia.

No eliminar información automáticamente.

Permitir:

* cancelar
* comparar
* crear nueva versión
* reemplazar mediante acción administrativa explícita

Registrar todo en auditoría.

==================================================
9. PROVEEDORES
==============

Crear automáticamente un perfil de proveedor cuando aparezca un RUC.

Campos mínimos:

* id
* ruc
* name
* normalizedName
* supplierType
* photoUrl
* cloudinaryPublicId
* createdAt
* updatedAt

supplierType:

PERSONA_NATURAL
PERSONA_JURIDICA
OTRO
DESCONOCIDO

No confiar exclusivamente en el nombre comercial.

Utilizar RUC como identificador principal.

==================================================
10. NORMALIZACIÓN DE PROVEEDORES
================================

El sistema debe detectar posibles variaciones.

Ejemplo:

MOLINERA SELVA E.I.R.LTDA.
MOLINERA SELVA EIRL
MOLINERA SELVA E.I.R.L.

Debe detectar posible coincidencia.

NO fusionar automáticamente.

Mostrar:

"Posible proveedor coincidente"

Permitir al administrador:

* fusionar
* mantener separados
* ignorar coincidencia

Registrar la acción.

==================================================
11. PERFIL DEL PROVEEDOR
========================

Crear página pública:

/proveedores/[slug]

Mostrar:

* fotografía
* razón social
* RUC
* tipo de proveedor
* total registrado
* total considerado
* total anulado
* cantidad de órdenes
* primera aparición
* última aparición
* años presentes
* historial por gestión
* historial por año
* historial mensual

Mostrar gráfico de evolución.

Mostrar tabla de órdenes.

==================================================
12. FOTOGRAFÍA DEL PROVEEDOR
============================

Desde el administrador:

/admin/proveedores

Debe poder abrir proveedor.

Debe existir:

* cargar fotografía
* cambiar fotografía
* eliminar fotografía
* vista previa

Utilizar Cloudinary.

La base de datos debe guardar únicamente referencias y URLs.

==================================================
13. ÓRDENES
===========

Crear entidad Order.

Debe conservar información normalizada y también datos originales.

Campos aproximados:

id
importBatchId
orderNumber
orderType
contractType
description
siafNumber
issueDate
commitmentDate
status
amount
ruc
supplierId
isCancelled
rawData
createdAt
updatedAt

rawData debe permitir conservar el registro original como JSON para soportar futuras modificaciones de los archivos fuente.

==================================================
14. ÓRDENES ANULADAS
====================

Detectar estados como:

ANULADA
ANULADO
CANCELADA
CANCELADO

pero NO depender exclusivamente de coincidencia exacta.

Crear lógica configurable para clasificar estados.

Una orden anulada:

* debe aparecer en las tablas
* debe aparecer en el historial
* debe aparecer en el perfil del proveedor
* debe aparecer en estadísticas de cantidad
* NO debe sumarse al monto económico considerado

Mostrar claramente:

Monto registrado
Monto anulado
Monto considerado

Ejemplo:

Monto registrado:
S/ 500,000

Monto anulado:
S/ 100,000

Monto considerado:
S/ 400,000

==================================================
15. RANKING DE PROVEEDORES
==========================

Crear página:

/ranking

Mostrar proveedores ordenados por monto considerado.

Separar:

RUC 10
RUC 20

Filtros:

* año
* mes
* periodo
* gestión
* tipo de RUC
* tipo de orden
* estado

Mostrar:

posición
proveedor
RUC
número de órdenes
monto registrado
monto anulado
monto considerado

Permitir abrir perfil.

==================================================
16. PROVEEDORES
===============

Crear:

/proveedores

Mostrar listado alfabético.

Filtros:

* RUC 10
* RUC 20
* todos

Buscador por:

* razón social
* RUC

Columnas:

Proveedor
RUC
Tipo
Órdenes
Monto
Primera aparición
Última aparición

==================================================
17. GESTIONES
=============

NO codificar las gestiones directamente.

Crear entidad:

ManagementPeriod

Campos:

id
name
startDate
endDate
description

Ejemplos:

2015-2018
2019-2022
2023-2026

Debe poder agregarse una nueva gestión sin modificar código.

==================================================
18. HISTORIAL DE PROVEEDORES
============================

Crear:

/historial

Objetivo:

detectar proveedores que aparecen en más de una gestión.

Ejemplo:

Proveedor ABC

2015-2018:
S/ 320,000

2019-2022:
S/ 780,000

2023-2026:
S/ 1,250,000

Total:
S/ 2,350,000

Mostrar filtros:

* proveedores con 2 gestiones
* proveedores con 3 gestiones
* proveedores con más gestiones

Al hacer clic abrir detalle.

==================================================
19. RESUMEN POR GESTIÓN
=======================

Crear gráficos y tablas comparativas.

Mostrar:

Cantidad de proveedores
Cantidad de órdenes
Monto registrado
Monto anulado
Monto considerado

Por cada gestión.

==================================================
20. DASHBOARD PÚBLICO
=====================

Página principal.

Mostrar tarjetas:

Total registrado
Total considerado
Órdenes
Órdenes anuladas
Proveedores
RUC 10
RUC 20

Mostrar:

* ranking de proveedores
* evolución mensual
* evolución anual
* gasto por gestión
* últimos registros
* principales tipos de contratación

==================================================
21. FILTROS GLOBALES
====================

Crear filtros reutilizables:

Año
Mes
Gestión
Proveedor
RUC
Tipo de orden
Estado
Rango de fechas

Los filtros deben actualizar tablas y gráficos.

==================================================
22. TABLAS
==========

Utilizar TanStack Table.

Características:

* paginación
* ordenamiento
* filtros
* búsqueda
* columnas configurables
* responsive
* exportación cuando corresponda

No cargar miles de registros al navegador.

Utilizar paginación del servidor.

==================================================
23. RENDIMIENTO
===============

La aplicación debe ser ligera.

Utilizar:

* server-side pagination
* consultas SQL optimizadas mediante Prisma
* índices
* caché cuando corresponda
* lazy loading
* componentes dinámicos únicamente cuando sean necesarios
* imágenes optimizadas
* Cloudinary transformations
* evitar consultas N+1
* agregaciones en PostgreSQL

NO enviar toda la base de datos al navegador.

==================================================
24. ÍNDICES DATABASE
====================

Crear índices para:

Order.ruc
Order.supplierId
Order.issueDate
Order.status
Order.importBatchId

Supplier.ruc
Supplier.normalizedName

ManagementPeriod.startDate
ManagementPeriod.endDate

Crear índices compuestos donde las consultas frecuentes lo justifiquen.

==================================================
25. SEGURIDAD
=============

Crear autenticación.

Roles:

SUPERADMIN
ADMIN
EDITOR
VIEWER

Proteger todas las rutas administrativas.

Nunca exponer secretos.

Utilizar variables:

DATABASE_URL
DIRECT_URL
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
AUTH_SECRET

Validar todos los inputs con Zod.

No confiar en datos enviados desde el navegador.

==================================================
26. AUDITORÍA
=============

Crear AuditLog.

Registrar:

usuario
acción
entidad
entidadId
fecha
IP si corresponde
metadata

Acciones:

IMPORT
UPDATE
DELETE
MERGE_SUPPLIER
CHANGE_PHOTO
CHANGE_COLUMN_VISIBILITY
CHANGE_SETTINGS

No eliminar registros críticos sin dejar trazabilidad.

==================================================
27. FRONTEND PÚBLICO
====================

Diseño moderno inspirado en:

* data journalism
* public transparency portals
* analytics dashboards
* SaaS moderno

No utilizar estética gubernamental antigua.

Debe ser:

* profesional
* sobrio
* intuitivo
* rápido
* responsive
* mobile first

Navegación:

Inicio
Órdenes
Proveedores
Ranking
Historial
Estadísticas
Metodología

==================================================
28. ADMIN
=========

Menú:

Dashboard

Importaciones

* Nueva importación
* Historial
* Errores
* Archivos

Órdenes

Proveedores

Gestiones

Columnas

Usuarios

Auditoría

Configuración

==================================================
29. ADMIN DASHBOARD
===================

Mostrar:

Importaciones realizadas
Última importación
Registros procesados
Errores
Advertencias
Proveedores detectados
Órdenes anuladas

Mostrar alertas:

"Existe un posible duplicado"

"Hay 12 proveedores con nombres similares"

"Hay 5 registros sin RUC"

==================================================
30. VALIDACIÓN DE DATOS
=======================

Detectar:

RUC inválido
Monto inválido
Fecha inválida
Proveedor vacío
Estado desconocido
Duplicado potencial
Número de orden repetido
Columnas faltantes

Clasificar:

ERROR
WARNING
INFO

No bloquear automáticamente por advertencias.

==================================================
31. ESTADOS CONFIGURABLES
=========================

No asumir que únicamente existen:

Devengada
Anulada

Crear catálogo de estados.

Permitir al administrador configurar qué estados:

* cuentan económicamente
* no cuentan económicamente
* se consideran anulados
* son desconocidos

==================================================
32. TIPOS DE ORDEN
==================

Crear catálogo configurable:

O/C
O/S
otros

No asumir que siempre serán los mismos.

==================================================
33. TRANSPARENCIA DE METODOLOGÍA
================================

Crear página:

/metodologia

Explicar:

* fuente de datos
* periodo
* fecha de actualización
* tratamiento de anulaciones
* clasificación RUC
* metodología de agrupación
* diferencia entre monto registrado y monto considerado
* limitaciones

Debe quedar claro que los datos son una representación procesada de los documentos fuente.

No generar acusaciones ni conclusiones automáticas sobre proveedores.

==================================================
34. EXPORTACIONES
=================

Permitir al administrador exportar:

CSV
XLSX

Y eventualmente PDF.

El visitante puede tener exportaciones limitadas dependiendo de configuración.

==================================================
35. API
=======

Diseñar API limpia.

Endpoints conceptuales:

GET /api/orders
GET /api/orders/[id]

GET /api/suppliers
GET /api/suppliers/[id]

GET /api/ranking

GET /api/history

GET /api/statistics

POST /api/admin/import

GET /api/admin/imports

POST /api/admin/suppliers/[id]/photo

==================================================
36. IA FUTURA
=============

No implementar IA pesada en la primera versión.

Preparar arquitectura para una segunda fase.

Futuro asistente:

"Pregúntale a los datos"

Ejemplos:

¿Cuáles fueron los 10 proveedores con mayor monto en 2025?

¿Cuánto registró la empresa ABC durante 2019-2022?

¿Qué proveedores aparecen en las tres gestiones?

¿Cuántas órdenes anuladas hubo en 2024?

La IA debe consultar datos estructurados mediante consultas seguras.

Nunca permitir que un modelo genere SQL arbitrario sin validación.

==================================================
37. ESCALABILIDAD
=================

Diseñar pensando inicialmente en:

10 años de información.

Posteriormente:

15
20
30 años.

Debe soportar cientos de miles o millones de órdenes.

No utilizar JSON como sustituto de tablas relacionales para información que necesite estadísticas frecuentes.

rawData únicamente debe conservar la representación original.

==================================================
38. ARCHITECTURE PRINCIPLES
===========================

Separar:

* presentación
* lógica de negocio
* acceso a datos
* procesamiento de archivos
* autenticación
* validación
* estadísticas

Crear servicios reutilizables:

importService
supplierService
statisticsService
rankingService
historyService
storageService
auditService

==================================================
39. EXPERIENCIA DEL USUARIO
===========================

El visitante debe poder entrar y responder rápidamente:

¿En qué se gasta el dinero?

¿Quiénes son los principales proveedores?

¿Cuánto recibe cada proveedor?

¿Hay proveedores que aparecen durante varias gestiones?

¿Qué órdenes fueron anuladas?

¿Qué se registró este mes?

Debe poder llegar a un proveedor en pocos clics.

==================================================
40. DISEÑO DE LA PÁGINA DEL PROVEEDOR
=====================================

Header:

Fotografía
Nombre
RUC
Tipo

Cards:

Monto considerado
Órdenes
Años
Gestiones

Tabs:

Resumen
Órdenes
Por año
Por gestión
Historial

Gráficos:

Evolución anual
Evolución mensual
Distribución por gestión

==================================================
41. MOBILE FIRST
================

En móvil:

No mostrar tablas gigantes.

Convertir registros en tarjetas cuando sea necesario.

Mantener filtros accesibles.

Botones grandes.

Navegación simple.

Optimizar especialmente para celulares de gama media.

==================================================
42. SEO
=======

Crear:

metadata
Open Graph
sitemap
robots
URLs amigables

Ejemplos:

/proveedores/molineraselva
/proveedores/ruc/20359435364
/ranking
/historial
/ordenes

Las páginas públicas de proveedores deben poder ser indexadas por buscadores.

==================================================
43. ACCESIBILIDAD
=================

Utilizar:

semantic HTML
labels
keyboard navigation
contraste adecuado
aria-label cuando corresponda

==================================================
44. PRINCIPIO FUNDAMENTAL
=========================

La aplicación debe distinguir claramente:

DATOS ORIGINALES

DATOS NORMALIZADOS

DATOS CALCULADOS

DATOS PÚBLICOS

No modificar silenciosamente los datos originales.

Todo cálculo debe poder ser explicado.

==================================================
45. DESARROLLO POR FASES
========================

FASE 1

Configuración:

Next.js
TypeScript
Tailwind
Prisma
Neon
Render
Cloudinary
Auth

FASE 2

Base de datos.

FASE 3

Sistema de autenticación.

FASE 4

Importador XLS/XLSX/CSV.

FASE 5

Validación y normalización.

FASE 6

Proveedores.

FASE 7

Órdenes.

FASE 8

Dashboard público.

FASE 9

Ranking.

FASE 10

Historial por gestiones.

FASE 11

Fotografías Cloudinary.

FASE 12

Auditoría.

FASE 13

Optimización.

FASE 14

SEO.

FASE 15

Pruebas.

FASE 16

Despliegue en Render.

==================================================
46. TESTING
===========

Crear pruebas para:

* importación
* RUC
* montos
* anulaciones
* duplicados
* proveedores
* gestiones
* rankings
* estadísticas

Probar especialmente:

Una orden anulada no debe sumarse.

Un proveedor con 20 órdenes debe aparecer una sola vez.

Un proveedor presente en tres gestiones debe aparecer correctamente en historial.

Importar dos veces el mismo archivo no debe duplicar información silenciosamente.

==================================================
47. README
==========

Crear documentación completa:

instalación
variables de entorno
Prisma
migraciones
seed
desarrollo local
deploy Render
Neon
Cloudinary
importación
roles
seguridad
backup
mantenimiento

==================================================
48. RESULTADO FINAL
===================

El resultado debe parecer una plataforma profesional de transparencia y análisis de datos públicos.

NO debe parecer:

* un Excel convertido en página
* un CRUD básico
* un dashboard genérico
* una plantilla administrativa

Debe parecer un producto digital serio de periodismo de datos / transparencia ciudadana.

Priorizar:

1. exactitud de los datos
2. trazabilidad
3. rendimiento
4. seguridad
5. escalabilidad
6. facilidad de administración
7. experiencia del ciudadano

Antes de implementar cada módulo, explicar brevemente:

* qué se va a construir
* qué tablas afecta
* qué endpoints necesita
* qué riesgos existen

No inventar datos.

No modificar silenciosamente registros importados.

No eliminar información original.

Construir el proyecto de manera incremental y mantenible.
