1. Arquitectura que te recomiendo
6
Stack
Frontend: Next.js + TypeScript
UI: Tailwind CSS + shadcn/ui
Backend: Next.js / API routes o Server Actions
ORM: Prisma
Base de datos: Neon PostgreSQL
Archivos originales: Cloudinary
Hosting: Render
Gráficos: Recharts
Tablas: TanStack Table
Validación: Zod
Procesamiento Excel: SheetJS / ExcelJS
Autenticación: Auth.js o sistema propio con sesiones seguras
Iconos: Lucide
Importación: XLS/XLSX/CSV
Responsive: móvil primero

La idea es que la aplicación sea ligera para el visitante, aunque internamente haga bastante procesamiento.

2. Concepto general de la web

Yo la plantearía como un portal ciudadano de seguimiento de órdenes de compra y servicios.

No solamente:

“Aquí están los Excel.”

Sino:

“Explora cómo se utilizan los recursos públicos.”

El visitante debería poder entrar y entender rápidamente:

Dashboard

Gasto registrado

S/ XX,XXX,XXX

Órdenes registradas

12,453

Proveedores

1,842

Proveedores RUC 10

1,120

Proveedores RUC 20

722

Órdenes anuladas

234

Periodo analizado

2015 – 2026

Y debajo:

ranking de proveedores
evolución mensual
gasto por año
gasto por gestión
órdenes anuladas
principales conceptos
últimos registros
3. El administrador

Aquí está una de las partes más importantes.

El administrador debería tener un menú:

DASHBOARD
│
├── Importar libros
├── Libros importados
├── Órdenes
├── Proveedores
├── Columnas
├── Gestiones
├── Categorías
├── Configuración
└── Usuarios
4. Importación inteligente

Esta sería una de las características principales.

El administrador selecciona:

Año: 2025

Mes: Enero

Y sube:

Lista-OCOS-ENERO-2025.xls

El sistema NO debería simplemente insertar todo.

Primero debería analizarlo.

Paso 1

Detectar automáticamente:

163 registros encontrados

12 columnas detectadas

Mostrar:

Columna	Detectada	Mostrar
N°	✓	☑
Tipo de Orden	✓	☑
Número de orden	✓	☑
Tipo de Contratación	✓	☑
Descripción	✓	☑
SIAF	✓	☐
Fecha de emisión	✓	☑
Fecha compromiso	✓	☑
Estado	✓	☑
Monto	✓	☑
RUC	✓	☑
Razón Social	✓	☑

Y el administrador decide qué columnas son públicas.

Pero ojo: yo separaría dos conceptos:

Campo almacenado

El sistema conserva el dato original.

Campo público

El administrador decide si se muestra al ciudadano.

Eso permite que mañana quieras mostrar una columna que inicialmente ocultaste sin volver a importar todo.

5. No sobrescribir los datos originales

Esto es fundamental.

Cada importación debe conservar:

Archivo original
        ↓
Importación
        ↓
Datos originales
        ↓
Datos normalizados
        ↓
Datos públicos

Así tendrás trazabilidad.

Por ejemplo:

Importación #125

Archivo:
Lista-OCOS-ENERO-2025.xls

Fecha:
05/10/2026

Registros:
163

Correctos:
161

Advertencias:
2

Errores:
0

Y el administrador puede entrar y revisar.

6. Detección de proveedores

Aquí empieza la parte realmente interesante.

El sistema detecta:

RUC
20359435364

y:

MOLINERA SELVA E.I.R.LTDA.

automáticamente crea:

Proveedor
ID: 382

RUC:
20359435364

Razón social:
MOLINERA SELVA E.I.R.LTDA.

Tipo:
RUC 20

Foto:
[Agregar fotografía]

Total contratado:
S/ XXX,XXX

Órdenes:
XX

Primera aparición:
2023

Última aparición:
2026
7. Identificación RUC 10 / RUC 20

El sistema puede determinarlo automáticamente.

Por ejemplo:

10XXXXXXXXX → Persona natural
20XXXXXXXXX → Persona jurídica

Pero no recomiendo confiar únicamente en los dos primeros dígitos.

El sistema debería guardar:

rucType

como:

PERSONA_NATURAL
PERSONA_JURIDICA
OTRO
DESCONOCIDO

Y además conservar el RUC original.

Así evitamos problemas con datos defectuosos.

8. Perfil del proveedor

Esta debería ser una página muy buena.

Por ejemplo:

MOLINERA SELVA E.I.R.LTDA.

RUC: 20359435364

[Fotografía]

Total contratado
S/ 1,284,530.00

Órdenes
27

Años registrado
2023 - 2026

Después:

Evolución

2023
S/ 350,000

2024
S/ 420,000

2025
S/ 514,530

2026
S/ ...

Órdenes
Fecha	Orden	Descripción	Monto	Estado
02/05/23	155	Leche evaporada...	S/294,840	Devengada
04/05/23	156	Harina...	S/84,240	Devengada

Y:

Participación por gestión
Gestión	Total
2015–2018	S/...
2019–2022	S/...
2023–2026	S/...
9. Proveedores recurrentes entre gestiones

Esta función puede convertirse en uno de los puntos más interesantes del proyecto.

La web debería detectar automáticamente:

Proveedores con presencia en más de una gestión

Por ejemplo:

PROVEEDORES RECURRENTES

Proveedor             2015-2018   2019-2022   2023-2026
---------------------------------------------------------
Empresa ABC           S/120,000   S/350,000   S/480,000
Empresa XYZ           S/80,000    S/210,000   S/190,000
Juan Pérez            S/30,000    —           S/90,000

Y permitir:

[Ver historial]

10. Importante: las gestiones NO deberían estar quemadas en código

No hagas:

if year >= 2015 && year <= 2018

Eso sería un error para una aplicación escalable.

Crea una tabla:

ManagementPeriod

con:

id
name
startDate
endDate
description

Entonces puedes crear:

Gestión 2015–2018
Gestión 2019–2022
Gestión 2023–2026

Y posteriormente:

Gestión 2027–2030

sin modificar código.

11. Órdenes anuladas

También lo haría a nivel de modelo.

Por ejemplo:

Estado original:
ANULADA

El sistema identifica:

isCancelled = true

Entonces:

En la tabla

Sí aparece.

En el historial

Sí aparece.

En estadísticas

Sí aparece.

En suma económica

No aparece.

Eso es importantísimo.

Por ejemplo:

Proveedor ABC

Órdenes:
10

Monto registrado:
S/ 500,000

Monto anulado:
S/ 100,000

Monto considerado:
S/ 400,000

Y mostrar claramente:

Monto considerado para estadísticas: S/400,000

Así evitas que alguien interprete que una orden anulada fue realmente ejecutada.

12. Ranking principal

Yo pondría una sección:

¿Quiénes reciben más?

Con filtros:

Periodo
Año
Mes
Gestión
Tipo de RUC
Estado
Tipo de orden

Y dos pestañas:

RUC 20
Empresa ABC — S/ 1,250,000
Empresa XYZ — S/ 890,000
Empresa DEF — S/ 720,000
RUC 10
Juan Pérez — S/ 350,000
María López — S/ 290,000
Pedro Torres — S/ 240,000

Con un botón:

Ver proveedor

13. "Proveedores"

Otra sección:

PROVEEDORES

[Buscar proveedor...]

RUC 10 | RUC 20

A
ABC
ACME
ALFA
...

B
...

C
...

Orden alfabético.

Pero también:

Nombre
RUC
Tipo
Total contratado
Número de órdenes
Primera aparición
Última aparición
14. Historial

La pestaña podría llamarse:

Historial de proveedores

Mostrar:

1,842 proveedores analizados

423 aparecen en más de una gestión

Filtro:

[ Todas ]
[ 2 gestiones ]
[ 3 gestiones ]

Ejemplo:

EMPRESA ABC

2015–2018
S/ 320,500

2019–2022
S/ 780,250

2023–2026
S/ 1,250,430

TOTAL
S/ 2,351,180

Al hacer clic:

Ver detalle

15. Modelo Prisma

Yo comenzaría aproximadamente con esta arquitectura:

User

ManagementPeriod

ImportBatch

ImportColumn

ColumnVisibility

Order

Supplier

SupplierAlias

SupplierPhoto

OrderStatus

OrderType

ContractType

SupplierManagementSummary

AuditLog

Y relaciones:

ManagementPeriod
        │
        ├── ImportBatch
        │       │
        │       └── Order
        │
        └── SupplierManagementSummary

Supplier
   │
   ├── Order
   ├── SupplierPhoto
   └── SupplierManagementSummary
16. La tabla Order

Una estructura conceptual:

Order {
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
}
¿Por qué rawData?

Porque los Excel pueden cambiar.

Hoy pueden tener 12 columnas.

Mañana:

15 columnas

o:

10 columnas

Puedes guardar el registro original como JSON y mantener el sistema resistente a cambios.

17. Proveedores
Supplier {
    id

    ruc
    name

    supplierType

    photoUrl

    normalizedName

    createdAt
    updatedAt
}

Pero agregaría:

normalizedName

porque los archivos podrían traer:

MOLINERA SELVA E.I.R.LTDA.

MOLINERA SELVA EIRL

MOLINERA SELVA E.I.R.L.

El sistema debería detectar que posiblemente son la misma empresa.

Pero nunca fusionarlos automáticamente sin control administrativo.

Crear:

Posible coincidencia encontrada.

Administrador:

[Fusionar] [Mantener separados]

Eso es mucho más seguro.

18. Importador inteligente

El flujo ideal sería:

SUBIR ARCHIVO
      ↓
Detectar formato
      ↓
Detectar encabezados
      ↓
Mapear columnas
      ↓
Validar datos
      ↓
Detectar RUC
      ↓
Detectar proveedores
      ↓
Detectar estados anulados
      ↓
Detectar duplicados
      ↓
Vista previa
      ↓
CONFIRMAR IMPORTACIÓN
      ↓
Procesamiento
      ↓
Base de datos

Nunca debería insertar directamente.

19. Detección de duplicados

Muy importante.

Si subes dos veces enero 2025:

ENERO 2025

el sistema debe avisar:

Ya existe una importación para este periodo.

Opciones:

[Cancelar]

[Comparar]

[Reemplazar]

[Crear nueva versión]

Yo recomiendo versionado, no borrado.

20. Cloudinary

Cloudinary lo utilizaría principalmente para:

Fotografías de proveedores
supplier/{supplierId}/profile
Logos
branding/
Documentos originales

También puede almacenar los Excel originales, aunque hay que diseñar bien las políticas de almacenamiento y acceso.

La base de datos solamente guarda:

cloudinaryPublicId
secureUrl

Nunca la imagen directamente dentro de PostgreSQL.

21. Neon

Neon será tu PostgreSQL.

La ventaja es que puedes mantener:

Development
Production

separados.

Y Prisma:

schema.prisma

será la fuente del modelo.

22. Render

Render:

Web Service
      ↓
Next.js
      ↓
Prisma
      ↓
Neon PostgreSQL

Cloudinary
      ↑
Fotos / archivos

Y recomiendo que el procesamiento pesado de Excel no bloquee la página.

Para archivos grandes:

Upload
 ↓
Create ImportJob
 ↓
Process
 ↓
Update progress
 ↓
Finish

El administrador podría ver:

Importando...

37%

4,825 / 12,500 registros procesados

23. El frontend debe ser diferente al administrador
Visitante

Minimalista:

Inicio
Proveedores
Ranking
Historial
Órdenes
Estadísticas
Metodología
Administrador

Más técnico:

Dashboard
Importaciones
Órdenes
Proveedores
Columnas
Gestiones
Usuarios
Auditoría
Configuración

Nunca mezclaría ambos diseños.

24. Transparencia y metodología

Te recomiendo agregar una página:

¿Cómo obtenemos estos datos?

Explicar:

Los datos publicados son procesados a partir de los archivos disponibles en el Portal de Transparencia...

Y explicar:

fuente
fecha de descarga
periodo
metodología
tratamiento de órdenes anuladas
clasificación RUC
criterios de agrupación
limitaciones

Esto le da mucha más credibilidad al proyecto.

25. No presentar conclusiones automáticas como acusaciones

Esto también es importante para el diseño.

La aplicación puede decir:

"Proveedor con mayor monto registrado"

Pero no:

"Proveedor favorecido"

porque eso ya sería una interpretación.

La plataforma debe mostrar datos verificables, dejando que el ciudadano saque sus conclusiones.

Incluso podrías poner:

Monto registrado en órdenes, no necesariamente monto efectivamente pagado.

Eso es muy importante.

26. Dashboard inteligente

La página principal podría detectar automáticamente:

Este mes
Se registraron 128 órdenes

Monto registrado:
S/ 2,450,300

87 proveedores

14 órdenes anuladas

Y:

Principales proveedores
1. ABC
2. XYZ
3. DEF
Comparación
2025 vs 2026
Tendencia

Gráfico:

Ene ──●
Feb ───●
Mar ─────●
Abr ──●
...
27. Búsqueda inteligente

En vez de solamente:

Buscar...

podrías permitir:

"Molinera Selva"

y encontrar:

proveedor
RUC
órdenes
historial

Y eventualmente:

"proveedores de combustible"

buscar dentro de las descripciones.

Incluso:

"¿Cuánto recibió ABC durante la gestión 2019-2022?"

La aplicación podría devolver el dato utilizando la base estructurada.

Esto sería una segunda fase.

28. IA: no la pondría al principio

Aquí te recomiendo algo importante.

No empezaría metiendo ChatGPT en todo.

Primero:

datos limpios + estructura + estadísticas correctas.

Después puedes añadir:

Asistente ciudadano
Pregúntale a los datos

¿Cuáles son los 10 proveedores
con mayor monto en 2024?

Y el sistema consulta la base.

Esto sería mucho más potente y barato que mandar todos los Excel a una IA.

29. Seguridad

El administrador debe tener:

login
2FA opcional
sesiones
roles
auditoría

Roles:

SUPERADMIN
ADMIN
EDITOR
LECTOR

Y registrar:

Usuario:
admin

Acción:
Modificó fotografía del proveedor

Fecha:
05/10/2026

IP:
...

Proveedor:
ABC
30. Diseño visual

Yo evitaría hacerla como una página gubernamental antigua.

Buscaría:

Data journalism + transparency dashboard + modern SaaS.

Debe sentirse:

seria
rápida
limpia
profesional
ciudadana
transparente

No excesivamente cargada.

31. Prompt maestro para construir la aplicación

Este es el prompt que puedes entregar a un agente de programación/IA para comenzar el proyecto:

Prompt maestro — Portal inteligente de transparencia de órdenes de compra y servicios

Quiero construir una aplicación web profesional, escalable, modular, rápida y ligera para consultar y analizar información pública de órdenes de compra y órdenes de servicio obtenidas del Portal de Transparencia.

La aplicación debe funcionar como un portal ciudadano de transparencia y análisis de gasto público.

NO quiero una aplicación que simplemente muestre archivos Excel.

Quiero que los archivos Excel/XLS/XLSX/CSV sean utilizados como FUENTE DE IMPORTACIÓN y que posteriormente los datos sean normalizados, almacenados y consultables desde PostgreSQL mediante Prisma.

==================================================

STACK TECNOLÓGICO
==================================================

Utilizar:

Next.js
TypeScript
React
Tailwind CSS
shadcn/ui
Prisma ORM
PostgreSQL
Neon PostgreSQL
Render para despliegue
Cloudinary para fotografías, imágenes y archivos cuando corresponda
TanStack Table para tablas avanzadas
Recharts para gráficos
Zod para validación
Lucide Icons
Sistema de autenticación seguro
Variables de entorno para secretos

La arquitectura debe permitir crecer posteriormente sin necesidad de reescribir la aplicación.

Debe estar preparada para manejar varios años de información y cientos de miles o millones de registros.

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

fotografías de proveedores
imágenes
archivos originales cuando corresponda

La aplicación permitirá importar libros mensuales descargados del Portal de Transparencia.

Por ejemplo:

2025

Enero
Febrero
Marzo
Abril
Mayo
Junio
Julio
Agosto
Septiembre
Octubre
Noviembre
Diciembre

El administrador debe poder subir uno o varios archivos correspondientes a diferentes meses.

La aplicación debe detectar automáticamente las columnas y permitir al administrador revisar la información antes de confirmar la importación.

El archivo de referencia contiene columnas similares a:

N°
Tipo de Orden
Número de orden
Tipo de Contratación
Descripción y Finalidad de la contratación
Nro. Exp. SIAF
Fecha de Emisión
Fecha de Compromiso
Estado
Monto
RUC
Denominación o razón Social

NO asumir que los próximos archivos tendrán exactamente las mismas columnas.

El sistema debe ser resistente a cambios en nombres, orden y cantidad de columnas.

Crear un módulo de importación.

Flujo:

Administrador selecciona año.
Selecciona mes.
Selecciona tipo de información.
Sube XLS/XLSX/CSV.
Sistema detecta automáticamente encabezados.
Sistema muestra columnas encontradas.
Sistema intenta mapearlas a campos internos.
Sistema muestra vista previa.
Sistema valida datos.
Sistema detecta errores.
Sistema detecta posibles duplicados.
Sistema detecta proveedores.
Sistema detecta RUC.
Sistema detecta estados anulados.
Sistema muestra resumen.
Administrador confirma.
Sistema procesa.
Sistema guarda ImportBatch.
Sistema registra todos los registros.
Sistema genera estadísticas.

Nunca insertar directamente sin mostrar una etapa de validación.

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

nombre original
nombre interno
tipo de dato
visible públicamente
obligatoria
descripción

El administrador debe poder activar/desactivar la visibilidad pública.

IMPORTANTE:

Desactivar una columna NO debe eliminarla de la base de datos.

La información original siempre debe conservarse.

Crear entidad ImportBatch.

Debe registrar:

id
filename
originalFilename
year
month
period
uploadedBy
uploadedAt
status
totalRows
successfulRows
warningRows
errorRows
checksum
originalFileUrl
processingStartedAt
processingFinishedAt

Estados:

UPLOADED
VALIDATING
PROCESSING
COMPLETED
COMPLETED_WITH_WARNINGS
FAILED

Si el administrador intenta importar nuevamente el mismo periodo, mostrar advertencia.

No eliminar información automáticamente.

Permitir:

cancelar
comparar
crear nueva versión
reemplazar mediante acción administrativa explícita

Registrar todo en auditoría.

Crear automáticamente un perfil de proveedor cuando aparezca un RUC.

Campos mínimos:

id
ruc
name
normalizedName
supplierType
photoUrl
cloudinaryPublicId
createdAt
updatedAt

supplierType:

PERSONA_NATURAL
PERSONA_JURIDICA
OTRO
DESCONOCIDO

No confiar exclusivamente en el nombre comercial.

Utilizar RUC como identificador principal.

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

fusionar
mantener separados
ignorar coincidencia

Registrar la acción.

Crear página pública:

/proveedores/[slug]

Mostrar:

fotografía
razón social
RUC
tipo de proveedor
total registrado
total considerado
total anulado
cantidad de órdenes
primera aparición
última aparición
años presentes
historial por gestión
historial por año
historial mensual

Mostrar gráfico de evolución.

Mostrar tabla de órdenes.

Desde el administrador:

/admin/proveedores

Debe poder abrir proveedor.

Debe existir:

cargar fotografía
cambiar fotografía
eliminar fotografía
vista previa

Utilizar Cloudinary.

La base de datos debe guardar únicamente referencias y URLs.

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

Detectar estados como:

ANULADA
ANULADO
CANCELADA
CANCELADO

pero NO depender exclusivamente de coincidencia exacta.

Crear lógica configurable para clasificar estados.

Una orden anulada:

debe aparecer en las tablas
debe aparecer en el historial
debe aparecer en el perfil del proveedor
debe aparecer en estadísticas de cantidad
NO debe sumarse al monto económico considerado

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

Crear página:

/ranking

Mostrar proveedores ordenados por monto considerado.

Separar:

RUC 10
RUC 20

Filtros:

año
mes
periodo
gestión
tipo de RUC
tipo de orden
estado

Mostrar:

posición
proveedor
RUC
número de órdenes
monto registrado
monto anulado
monto considerado

Permitir abrir perfil.

Crear:

/proveedores

Mostrar listado alfabético.

Filtros:

RUC 10
RUC 20
todos

Buscador por:

razón social
RUC

Columnas:

Proveedor
RUC
Tipo
Órdenes
Monto
Primera aparición
Última aparición

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

proveedores con 2 gestiones
proveedores con 3 gestiones
proveedores con más gestiones

Al hacer clic abrir detalle.

Crear gráficos y tablas comparativas.

Mostrar:

Cantidad de proveedores
Cantidad de órdenes
Monto registrado
Monto anulado
Monto considerado

Por cada gestión.

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

ranking de proveedores
evolución mensual
evolución anual
gasto por gestión
últimos registros
principales tipos de contratación

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

Utilizar TanStack Table.

Características:

paginación
ordenamiento
filtros
búsqueda
columnas configurables
responsive
exportación cuando corresponda

No cargar miles de registros al navegador.

Utilizar paginación del servidor.

La aplicación debe ser ligera.

Utilizar:

server-side pagination
consultas SQL optimizadas mediante Prisma
índices
caché cuando corresponda
lazy loading
componentes dinámicos únicamente cuando sean necesarios
imágenes optimizadas
Cloudinary transformations
evitar consultas N+1
agregaciones en PostgreSQL

NO enviar toda la base de datos al navegador.

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

Diseño moderno inspirado en:

data journalism
public transparency portals
analytics dashboards
SaaS moderno

No utilizar estética gubernamental antigua.

Debe ser:

profesional
sobrio
intuitivo
rápido
responsive
mobile first

Navegación:

Inicio
Órdenes
Proveedores
Ranking
Historial
Estadísticas
Metodología

Menú:

Dashboard

Importaciones

Nueva importación
Historial
Errores
Archivos

Órdenes

Proveedores

Gestiones

Columnas

Usuarios

Auditoría

Configuración

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

No asumir que únicamente existen:

Devengada
Anulada

Crear catálogo de estados.

Permitir al administrador configurar qué estados:

cuentan económicamente
no cuentan económicamente
se consideran anulados
son desconocidos

Crear catálogo configurable:

O/C
O/S
otros

No asumir que siempre serán los mismos.

Crear página:

/metodologia

Explicar:

fuente de datos
periodo
fecha de actualización
tratamiento de anulaciones
clasificación RUC
metodología de agrupación
diferencia entre monto registrado y monto considerado
limitaciones

Debe quedar claro que los datos son una representación procesada de los documentos fuente.

No generar acusaciones ni conclusiones automáticas sobre proveedores.

Permitir al administrador exportar:

CSV
XLSX

Y eventualmente PDF.

El visitante puede tener exportaciones limitadas dependiendo de configuración.

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

Diseñar pensando inicialmente en:

10 años de información.

Posteriormente:

15
20
30 años.

Debe soportar cientos de miles o millones de órdenes.

No utilizar JSON como sustituto de tablas relacionales para información que necesite estadísticas frecuentes.

rawData únicamente debe conservar la representación original.

Separar:

presentación
lógica de negocio
acceso a datos
procesamiento de archivos
autenticación
validación
estadísticas

Crear servicios reutilizables:

importService
supplierService
statisticsService
rankingService
historyService
storageService
auditService

El visitante debe poder entrar y responder rápidamente:

¿En qué se gasta el dinero?

¿Quiénes son los principales proveedores?

¿Cuánto recibe cada proveedor?

¿Hay proveedores que aparecen durante varias gestiones?

¿Qué órdenes fueron anuladas?

¿Qué se registró este mes?

Debe poder llegar a un proveedor en pocos clics.

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

En móvil:

No mostrar tablas gigantes.

Convertir registros en tarjetas cuando sea necesario.

Mantener filtros accesibles.

Botones grandes.

Navegación simple.

Optimizar especialmente para celulares de gama media.

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

Utilizar:

semantic HTML
labels
keyboard navigation
contraste adecuado
aria-label cuando corresponda

La aplicación debe distinguir claramente:

DATOS ORIGINALES

DATOS NORMALIZADOS

DATOS CALCULADOS

DATOS PÚBLICOS

No modificar silenciosamente los datos originales.

Todo cálculo debe poder ser explicado.

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

Crear pruebas para:

importación
RUC
montos
anulaciones
duplicados
proveedores
gestiones
rankings
estadísticas

Probar especialmente:

Una orden anulada no debe sumarse.

Un proveedor con 20 órdenes debe aparecer una sola vez.

Un proveedor presente en tres gestiones debe aparecer correctamente en historial.

Importar dos veces el mismo archivo no debe duplicar información silenciosamente.

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

El resultado debe parecer una plataforma profesional de transparencia y análisis de datos públicos.

NO debe parecer:

un Excel convertido en página
un CRUD básico
un dashboard genérico
una plantilla administrativa

Debe parecer un producto digital serio de periodismo de datos / transparencia ciudadana.

Priorizar:

exactitud de los datos
trazabilidad
rendimiento
seguridad
escalabilidad
facilidad de administración
experiencia del ciudadano

Antes de implementar cada módulo, explicar brevemente:

qué se va a construir
qué tablas afecta
qué endpoints necesita
qué riesgos existen

No inventar datos.

No modificar silenciosamente registros importados.

No eliminar información original.

Construir el proyecto de manera incremental y mantenible.

32. Plan real de trabajo

Yo no intentaría construir todo de una vez.

Lo haría así:

Etapa 1 — Base
Next.js
Prisma
Neon
Render
Cloudinary
Auth
Etapa 2 — Importador

Aquí probaría exactamente con el Excel que me acabas de proporcionar.

Es fundamental porque ya sabemos cómo viene realmente la información.

Etapa 3 — Base de proveedores
RUC
Nombre
tipo
fotografía
Etapa 4 — Órdenes

Aquí implementamos correctamente:

Monto
Estado
Anulación
Proveedor
Fecha
Etapa 5 — Dashboard
Etapa 6 — Ranking
Etapa 7 — Historial de gestiones
Etapa 8 — Auditoría
Etapa 9 — Optimización
Etapa 10 — IA
33. Una mejora que considero MUY importante

Yo agregaría una función que probablemente te resulte muy útil:

"Ficha de evidencia"

En cada orden:

Fuente original

Y permitir al administrador conservar el archivo original y, si es posible, la referencia exacta del documento descargado.

Por ejemplo:

Orden 155

Proveedor:
MOLINERA SELVA E.I.R.LTDA.

Monto:
S/ 294,840

Estado:
Devengada

Fuente:
Libro mayo 2023

Importación:
#00037

Archivo:
Lista-OCOS-MAYO-2023.xls

Así, si alguien cuestiona un dato, puedes demostrar de dónde salió.

Eso convierte la página en algo mucho más serio que un simple ranking.

34. Y una segunda mejora: "Explorar el dinero"

En lugar de que toda la navegación sea técnica, el ciudadano debería tener recorridos muy simples:

¿Quiénes reciben más?

→ Ranking.

¿Quién es este proveedor?

→ Perfil.

¿Desde cuándo contrata?

→ Historial.

¿Cuánto recibió en cada gestión?

→ Comparación.

¿Qué órdenes tiene?

→ Detalle.

¿Qué fue anulado?

→ Órdenes anuladas.

Eso es lo que haría que la plataforma sea realmente intuitiva e inteligente, y no solamente una base de datos.

En resumen

Tu idea es perfectamente realizable con Render + Neon + Prisma + Cloudinary, y el archivo que adjuntaste confirma que podemos empezar con una estructura concreta de 12 columnas y después hacer que el importador sea tolerante a cambios.

La clave arquitectónica es esta: Excel → importación → validación → normalización → PostgreSQL → estadísticas → frontend. Nunca Excel → frontend directamente.

Y si quieres que esto pueda durar 10, 15 o 20 años, debemos diseñar desde el comienzo el concepto de gestiones, versiones de importación, proveedores históricos, auditoría y datos originales.