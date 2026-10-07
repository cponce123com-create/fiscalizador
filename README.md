# Portal de Transparencia — Órdenes de Compra y Servicio

Aplicación web para consultar y analizar las órdenes de compra (O/C) y de servicio
(O/S) publicadas en el Portal de Transparencia.

El objetivo no es «mostrar un Excel», sino **normalizar, almacenar y consultar**
esos datos desde PostgreSQL. Los libros de Excel son la **fuente de importación**,
nunca la fuente de presentación.

---

## Estado actual

Esta entrega cubre las **Fases 1 a 10** del plan: base del proyecto, modelo de datos
completo, autenticación, el **importador funcionando de extremo a extremo**
—verificado contra el libro real del portal— y el **portal público** completo
(portada, órdenes, proveedores, ranking, historial, estadísticas y vínculos
declarados).

**Incluido:** esquema completo, migraciones, seed, autenticación con roles,
importador en dos fases con validación y normalización, **carga por lotes de varios
libros con el periodo deducido del contenido** y **detección de duplicados por
contenido** (reimportar un libro ya no duplica sus órdenes), auditoría, panel de
administración, **acceso con verificación en dos pasos y cambio obligatorio de la
contraseña inicial**, listados públicos paginados y filtrados en servidor, perfil
de proveedor, ranking con pesos, historial por gestiones, estadísticas comparadas
con concentración del gasto, **registro de personas señaladas con etiquetas y
vínculos deducidos del DNI**, perfiles privados con fotos en Cloudinary, gráficos y pruebas automatizadas.

**Pendiente (fases posteriores):** auditoría visible en el panel y optimización fina. El asistente con IA queda fuera
de alcance por decisión expresa.

> El SEO y el despliegue **ya están hechos**, no pendientes: hay `robots.txt`,
> `sitemap.xml`, metadatos por página y un despliegue en Render con health check
> (ver `docs/operacion.md`). Esta lista decía lo contrario y una auditoría externa
> lo dio por bueno, así que se corrige aquí.

Documentación relacionada:

| Documento | Contenido |
|---|---|
| [`docs/prompt.md`](docs/prompt.md) | Especificación de requisitos (48 secciones) |
| [`docs/plan-de-trabajo.md`](docs/plan-de-trabajo.md) | Comentario arquitectónico de referencia |
| [`docs/reference/FORMATOS.md`](docs/reference/FORMATOS.md) | Formatos reales del libro fuente, medidos sobre el archivo |

---

## Requisitos

- **Node.js 20.19 o superior.** El proyecto se desarrolló y verificó con **20.19.1**.
  Para desplegar conviene **Node 22 o superior**: Prisma 7.10 arrastra un paquete
  (`@prisma/streams-local`) que declara Node ≥ 22. En Node 20 funciona, pero emite
  una advertencia de motor.

  El mínimo 20.19 no es un capricho: el CLI de Prisma carga una dependencia ESM
  (`zeptomatch`) desde CommonJS, y `require()` de un módulo ESM solo funciona a partir
  de Node 20.19 y en la 22. Con 20.18 el CLI muere con `ERR_REQUIRE_ESM` y no arranca
  ni `prisma generate`.
- **PostgreSQL.** En desarrollo y producción se usa **Neon** (PostgreSQL
  gestionado). Cualquier PostgreSQL compatible sirve.
- **npm 10 o superior.**

---

## Puesta en marcha

```bash
# 1. Dependencias
npm install

# 2. Variables de entorno
cp .env.example .env
# Edita .env y completa DATABASE_URL, DIRECT_URL y AUTH_SECRET

# 3. Crear el esquema en la base de datos
npm run db:deploy      # en producción
npm run db:migrate     # en desarrollo (crea migraciones nuevas)

# 4. Datos iniciales: catálogos, gestiones, visibilidad de columnas y SUPERADMIN
npm run db:seed

# 5. Arrancar
npm run dev
```

El panel está en `http://localhost:3000/admin`.

> `npm install` ejecuta `prisma generate` automáticamente (`postinstall`). El
> cliente generado vive en `lib/generated/`, que **no se versiona**: se regenera.

---

## Variables de entorno

Todas se validan al arrancar (`lib/env.ts`). Si falta una o está mal formada, la
aplicación falla de inmediato con un mensaje claro en vez de romper a mitad de una
importación.

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión **con pooling** (host `-pooler`). La usa la aplicación en runtime. |
| `DIRECT_URL` | Sí | Conexión **directa**, sin pooling. La usan las migraciones de Prisma. |
| `AUTH_SECRET` | Sí | Secreto para firmar sesiones. Mínimo 32 caracteres. Generar con `openssl rand -base64 32`. |
| `SEED_SUPERADMIN_EMAIL` | No | Correo del primer SUPERADMIN. Solo lo usa el seed. |
| `SEED_SUPERADMIN_PASSWORD` | No | Contraseña del primer SUPERADMIN. Mínimo 12 caracteres. |
| `STORAGE_DRIVER` | No | `local` (por defecto) o `cloudinary` (fase posterior). |
| `STORAGE_LOCAL_DIR` | No | Directorio de los archivos originales. Por defecto `./storage/uploads`. |
| `CLOUDINARY_*` | No | Credenciales necesarias para subir/consultar las fotos privadas de proveedores. |
| `NEXT_PUBLIC_CONTACTO_CORRECCIONES` | No | Correo que se muestra en `/metodologia` para solicitar correcciones o rectificaciones. Si falta, la página avisa de que el canal no está configurado. |

Las variables con prefijo `NEXT_PUBLIC_` se incrustan en el HTML **en tiempo de
compilación** y las lee el navegador: no pasan por `lib/env.ts`. No pongas en ellas
nada que no deba ser público.

`.env` está en `.gitignore`. **Nunca se versiona.**

---

## Arquitectura

Una sola aplicación Next.js (App Router). La separación no es por servicios
desplegables, sino **por capas**:

```
app/                     Presentación (páginas y manejadores de ruta)
  (public)/              Portal ciudadano (páginas públicas)
  admin/(panel)/         Panel autenticado
  admin/login/           Formulario de acceso (fuera del layout protegido)
  api/                   Endpoints HTTP
components/
  admin/                 Componentes del panel
  publico/               Componentes del portal ciudadano
  ui/                    Primitivos de interfaz (botón, tarjeta, tabla, aviso…)
lib/
  api/                   Cliente de API y respuestas HTTP
  auth/                  Contraseñas, permisos y guardián de sesión
  errors.ts              Errores de dominio
  env.ts                 Validación de variables de entorno
  prisma.ts              Cliente Prisma con driver adapter
  utils.ts               Formato de montos y fechas
prisma/
  schema.prisma          Modelo de datos
  migrations/            Migraciones
  seed.ts                Datos iniciales
services/                Lógica de negocio (sin HTTP, sin React)
  importService.ts       Orquestación del importador en dos fases
  parseService.ts        Lectura del libro (SheetJS)
  mappingService.ts      Catálogo de alias y detección de columnas
  validationService.ts   Reglas de validación y cálculo de montos
  normalizationService   → normalization.ts (RUC, montos, fechas, texto)
  supplierService.ts     Alta de proveedores y resúmenes por gestión
  statisticsService.ts   Agregaciones del portal público (listados, ranking, estadísticas)
  personsService.ts      Personas señaladas, etiquetas y vínculos deducidos del DNI
  storageService.ts      Almacenamiento de archivos originales
  auditService.ts        Registro de auditoría
```

**Regla de dependencia:** `app/` → `services/` → `lib/`. Ningún componente de
interfaz accede a Prisma directamente, salvo las páginas de solo lectura del panel,
que lo hacen a propósito para no crear una capa de paso innecesaria.

### Decisiones que conviene conocer antes de tocar el código

1. **Los montos son `Decimal(14,2)`, nunca `Float`.** Las sumas se comprueban en
   centavos enteros. Es la prioridad declarada del proyecto: exactitud.
2. **`isCancelled` sale del catálogo `OrderStatus`**, no de comparar texto. Un
   estado nuevo se clasifica desde la base de datos, sin desplegar.
3. **`rawData` conserva el registro original** tal como venía en el libro. Lo
   normalizado es una proyección; el original nunca se sobrescribe.
4. **`middleware.ts` fue sustituido por `proxy.ts`** (convención de Next.js 16).
   Solo importa `auth.config.ts`, que es seguro para el runtime Edge. Importar
   `auth.ts` arrastraría Prisma al bundle de Edge y rompería el build.
5. **Las fechas se formatean en UTC.** Las columnas son `@db.Date` y se guardan a
   medianoche UTC; formatearlas en hora local mostraría el día anterior en Perú.

---

## El importador

Funciona en **dos fases**, y esa separación es el núcleo del diseño.

### Carga por lotes

La pantalla de importar acepta **varios libros a la vez** (hasta 20): se arrastran
sobre la zona de carga y se procesan en cola. El mes y el año de cada libro **se
deducen de sus fechas de emisión** —`POST /api/admin/imports/periodo`, que no escribe
nada— así que importar un año entero no obliga a elegir doce meses a mano; el
administrador revisa y corrige los periodos antes de analizar. El tipo de información
se elige una vez y se aplica a toda la tanda.

Al terminar el análisis, **cada libro muestra un resumen de lo que hay que mirar**:
filas repetidas dentro del libro, filas sin gestión, filas con aviso, filas con error y
lo que ya está en el portal. Arriba se indica cuántos libros traen algo y hay un
interruptor para **ver solo esos**, de manera que una tanda de doce libros no obliga a
abrir doce fichas cuando solo tres tienen algo que revisar.

Cada libro se analiza y se confirma con su propia petición: el progreso es por archivo
y un libro defectuoso **no detiene a los demás**. Lo que falla queda marcado en su
fila con el motivo y el resto se importa igual. Si el periodo ya tiene importaciones,
hay que marcar «versión nueva» de forma explícita, porque nada se reemplaza en
silencio.

**Duplicados por contenido.** Un libro repetido se reconoce de dos maneras: por su
huella (los mismos bytes) y por su contenido. Lo segundo importa porque el portal
vuelve a publicar libros corregidos con bytes distintos y las mismas órdenes: se
comparan las claves de deduplicación (número de orden + RUC + monto + fecha) con las
que ya están en la base de datos. Si el libro no aporta ninguna fila nueva, se excluye
por defecto con el motivo a la vista; si aporta solo algunas, se avisa de cuántas ya
estaban. Y al confirmar se descartan las filas repetidas (`omitirDuplicados`), así que
reimportar un libro **no duplica nada**: la operación es repetible.

### Fase 1 — Analizar (no escribe nada)

`POST /api/admin/imports/analyze`

1. Guarda el archivo original íntegro.
2. Lee el libro con **SheetJS** y detecta la fila de encabezado.
3. Empareja cada columna con un campo interno, por coincidencia exacta, alias o
   similitud, e informa el método y la confianza de cada propuesta.
4. Valida fila por fila y clasifica los hallazgos en **ERROR**, **WARNING** o
   **INFO**.
5. Detecta duplicados: mismo archivo (checksum), mismo periodo ya importado y filas
   que ya están en el portal.
6. Devuelve columnas detectadas, resumen, vista previa, hallazgos y cuánto del libro
   es nuevo (`duplicadoContenido`).

### Fase 2 — Confirmar (una sola transacción)

`POST /api/admin/imports/confirm`

**Relee el archivo guardado en el servidor** y escribe todo de una vez: proveedores,
órdenes, resúmenes por gestión y auditoría. Si algo falla, no queda nada a medias.

El paso del lote a «procesando» es una **transición atómica**: si dos confirmaciones del
mismo lote se cruzan, solo una lo toma y la otra recibe un error claro en lugar de que
las dos escriban. Un lote que quedó colgado en «procesando» —por ejemplo, porque el
servicio se reinició a mitad— se puede reanudar pasados **diez minutos**, y la
recuperación queda anotada en la auditoría.

Antes de insertar descarta las filas cuya clave de deduplicación ya existe
(`omitirDuplicados`, activado por defecto) e informa de cuántas omitió. La comparación
es contra lo que había **antes** de esta importación, no entre las filas nuevas: las
dos filas reales del libro que comparten número de orden entran juntas la primera vez y
se omiten juntas al repetir.

El cuerpo de la petición **no lleva filas**, solo el identificador del lote y las
correcciones de mapeo. Es deliberado: si el navegador pudiera enviar las filas ya
normalizadas, podría insertar registros que no existen en el archivo original.

### Decidir fila a fila

Antes de confirmar, la pantalla de revisión muestra **las filas que se importarían y
traen algún hallazgo**, con sus datos (número de orden, proveedor, fecha y monto) y el
motivo. Cada una lleva un interruptor para **dejarla fuera**: la fila no se inserta, y
tampoco se crea su proveedor ni su resumen por gestión.

No todas se pueden incluir. Las que tienen un **error** —sin número de orden o sin un
RUC válido— no se importan y no hay nada que decidir sobre ellas: una orden necesita
número y proveedor para poder guardarse. La pantalla las lista aparte, con el motivo,
para poder corregirlas en el archivo de origen y volver a analizarlo.

La decisión viaja como una **lista de números de fila**, no como datos: el servidor
vuelve a leer el archivo guardado y descarta esas filas, igual que hace con las
correcciones de mapeo. Queda registrada en la auditoría del lote.

### Catálogos configurables

`/admin/catalogos` (rol ADMIN o superior) reúne los cuatro catálogos de los que depende el
importador: **estados**, **tipos de orden**, **tipos de contratación** y **gestiones**.

Son datos, no código: clasificar un estado nuevo —decidir si cuenta como gasto— no exige
desplegar la aplicación. El estado decide qué suma al **monto considerado**, así que
cambiarlo mueve las cifras públicas al instante; por eso la pantalla exige el mismo
permiso que importar y cada cambio queda auditado, con el antes y el después.

Dos reglas valen para los cuatro:

- El **código** se normaliza (`MAYÚSCULAS_CON_GUIONES`) y los **alias** se guardan con la
  misma normalización que usa el importador para leer el libro. Cambiar el código no altera
  lo ya importado: las órdenes apuntan al identificador, no al código.
- Nada se **elimina** si está en uso: en lugar de un error de base de datos, la pantalla
  dice cuántas órdenes lo usan y ofrece **desactivarlo**, que no toca nada de lo importado
  y solo deja de reconocerlo en los libros siguientes.

Los estados que traen los libros de otros meses del mismo portal —`Comprometida` y
`Emitida`— ya vienen en el seed y cuentan como gasto.

### Eliminar una importación

Desde `/admin/importaciones` (rol ADMIN o superior) se puede borrar una importación
completa: sus órdenes, sus columnas, sus hallazgos y el archivo original. No se puede
deshacer, y no se permite mientras el lote se está procesando; si el proceso lleva más de
diez minutos colgado, se da por perdido y sí se puede borrar.

Borrar órdenes obliga a **rehacer los resúmenes por (proveedor, gestión)** que ese lote
alimentaba: las órdenes se van por cascada, pero `SupplierManagementSummary` no, y sin
rehacerlo el portal seguiría contando órdenes que ya no existen. Los resúmenes que se
quedan sin órdenes se eliminan; los que todavía tienen alguna se recalculan desde las
órdenes reales.

Los proveedores que se queden sin ninguna orden se borran también, salvo que tengan
órdenes en otra importación, un vínculo declarado o una fotografía. Es la vía para vaciar
una carga de prueba y empezar de cero.

La baja queda en la auditoría con sus cifras. El rastro sobrevive al lote porque
`AuditLog.entityId` es texto, sin clave foránea hacia él: el portal puede decir qué se
borró, cuándo y quién lo hizo.

### Reglas de validación

- **RUC:** 11 dígitos y dígito verificador (módulo 11). Formato inválido es ERROR;
  dígito verificador incorrecto es WARNING y el dato se conserva.
- **Montos:** convención `es-PE`. Lo que no se entiende se guarda como `null` con el
  texto original en `rawAmount` y un WARNING, **nunca como cero**.
- **Estados:** se buscan en el catálogo. Un estado desconocido cae en `DESCONOCIDO`,
  se advierte y **no suma** al monto considerado.
- **Duplicados:** nunca se bloquean solos. Se advierten, se excluyen por defecto en la
  revisión y decide el administrador. Lo que sí es automático es no volver a insertar
  una fila que ya está: reimportar un libro no duplica sus órdenes.

---

## Vínculos declarados

Sección pública en **`/vinculos`**, alimentada desde **`/admin/personas`** y
**`/admin/etiquetas`**.

Sirve para cruzar el gasto del portal con información que solo tiene la
administración: qué proveedores están detrás de un aportante de campaña, de un
postulante a regidor, de un comunicador o de un familiar de un político.

**El vínculo no se inventa, se deduce.** El RUC de una persona natural es
`10 + DNI + dígito verificador`, así que el DNI viaja dentro del RUC: registrar el DNI
basta para que el sistema encuentre solo a los proveedores de esa persona. Los
vínculos deducidos **no se guardan en la base de datos**, se calculan al vuelo; de ese
modo, un proveedor que se importe mañana queda vinculado sin resincronizar nada. Lo
único que se persiste son los vínculos **manuales**, para lo que el DNI no alcanza
(una empresa de la que la persona es titular).

**Las etiquetas son un catálogo**, no texto libre, porque de ellas salen las sumas:
«cuánto ganan los comunicadores» solo cuadra si la etiqueta se escribe siempre igual.
Se crean, se renombran, se reordenan, se desactivan y se ocultan sin tocar código.

**Qué se publica y qué no.** Se publican el nombre, la descripción, la fuente, el
proveedor vinculado y su monto. El **DNI no se publica nunca** (Ley 29733 de
protección de datos personales). La descripción y la fuente son **obligatorias**: esta
sección afirma cosas sobre personas reales, así que cada ficha dice qué se afirma y de
dónde sale, y la página avisa de que **no es una conclusión legal ni una imputación**.
Una ficha marcada como no pública se queda en el panel.

Los montos usan la **misma regla de monto considerado** que el resto del portal, así
que los totales de `/vinculos` cuadran con los del ranking. Un proveedor vinculado a
dos personas de la misma etiqueta cuenta una sola vez.

---

## Roles y permisos

| Rol | Alcance |
|---|---|
| `SUPERADMIN` | Todo, incluida la gestión de usuarios y la configuración |
| `ADMIN` | Gestión completa de datos, importaciones y vínculos. No gestiona usuarios ni configuración |
| `EDITOR` | Mantiene lo ya importado. **No importa ni publica vínculos**: cargar un libro o señalar a una persona cambia lo que ve el ciudadano |
| `VIEWER` | Solo lectura. **No entra en el registro de personas**, que contiene DNIs |

Los permisos se comprueban **contra la base de datos en cada petición**, no solo en
el middleware. Así, desactivar una cuenta o bajarle el rol surte efecto de inmediato
en lugar de esperar a que caduque el token.

---

## Verificación

```bash
npm run typecheck   # TypeScript en modo estricto
npm run lint        # ESLint
npm test            # Pruebas unitarias y de integración sobre el archivo real

npm run verify      # Importación completa contra la base de datos real
                    # Añade --limpiar para repetirla desde cero
./scripts/verificar-login.sh   # Autenticación de extremo a extremo
```

`npm test` incluye pruebas que contrastan las cifras que publica el portal con las del
libro de referencia (`docs/reference/Lista-OCOS-2023-06.xls`): comprueban que coinciden
exactamente con las medidas durante el desarrollo:

| Métrica | Valor |
|---|---|
| Órdenes | 103 |
| Proveedores | 72 |
| Monto registrado | `S/ 1,066,136.59` |
| Monto anulado | `S/ 38,994.87` |
| **Monto considerado** | **`S/ 1,027,141.72`** |

Si el importador deja de reproducir estas cifras, la prueba falla. Es la red de
seguridad que impide que un cambio de formato o de redondeo pase desapercibido.

Las pruebas de integración se ejecutan **contra la base de datos real** y se saltan
solas si no hay `DATABASE_URL`. La mayoría crea y borra sus propios datos (proveedores
de prueba, fichas de verificación, lotes de importación y sus archivos), así que se
pueden repetir sin dejar rastro; comprueban, entre otras cosas, que reimportar un libro
**no aumenta** el número de órdenes y que el DNI dentro del RUC de una persona natural
encuentra su ficha.

**Las pruebas que contrastan cifras necesitan el libro cargado**: contrastan lo que
publica el portal, así que con una base vacía no tienen nada que comprobar y fallan
diciéndolo, en lugar de fallar una a una con un mensaje que no explica nada. En un
portal vacío, el orden es `npm run verify` (carga el libro de referencia) y después
`npm test`.

---

## Seguridad

- Contraseñas con **argon2id** (`@node-rs/argon2`, sin compilación nativa).
- Sesiones en cookie `httpOnly`, estrategia JWT, 8 horas.
- El inicio de sesión verifica la contraseña **siempre**, incluso cuando el correo
  no existe, para no filtrar qué cuentas están registradas por diferencia de tiempo.
- **Límite de intentos persistente.** 5 fallos en 15 minutos bloquean 15 minutos, por
  correo y por IP. El contador vive en PostgreSQL (`LoginAttempt`), no en la memoria del
  proceso: sobrevive a los reinicios y se comparte entre instancias. El mensaje al
  usuario sigue siendo genérico y el tiempo de respuesta no cambia, así que un bloqueo
  no se distingue de unas credenciales incorrectas. Los fallos y los bloqueos quedan en
  la auditoría. La IP se toma de `X-Forwarded-For` (el proxy de Render): es orientativa,
  no infalsificable.
- Los mensajes de error de la API nunca incluyen detalles internos.
- Toda entrada se valida con Zod en el borde de la API.
- El nombre del archivo subido se usa solo para mostrarlo: la ruta de almacenamiento
  se deriva del checksum, así que no puede usarse para escapar del directorio.

### Puntos a resolver antes de producción

1. **Rotar la contraseña de la base de datos.** La credencial de Neon se compartió en
   claro durante la configuración.

   Lo mismo vale para la contraseña del superadministrador, que también se compartió
   en claro. Con `--exigir-cambio` se le obliga a cambiarla: la actual sigue sirviendo
   para entrar y cambiarla, pero el panel no se abre hasta entonces.

       npm run usuarios -- --email <correo> --exigir-cambio
2. **Almacenamiento persistente.** Con `STORAGE_DRIVER=local` los archivos originales
   se guardan en disco. En Render el disco de un servicio web es **efímero**: los
   archivos se perderían en cada despliegue. Hay que usar un volumen persistente o
   Cloudinary (adaptador ya previsto).

   Ojo con `STORAGE_LOCAL_DIR`: si apunta a un disco que no está montado —por ejemplo
   `/var/data/uploads` cuando el disco no se ha creado, porque los discos persistentes
   requieren plan de pago— el directorio no se puede crear y **toda importación falla**.
   Desde esta entrega el error lo dice con su código (`EACCES (permiso denegado)`,
   `ENOENT (la ruta no existe)`…) en lugar de devolver un 500 sin explicación, pero
   conviene comprobarlo antes de dar un despliegue por bueno: sube un libro y mira que
   el análisis llegue a la pantalla de revisión.
3. **`AUTH_SECRET` distinto por entorno** y nunca reutilizado.
4. **Añadir 2FA** para las cuentas administrativas (previsto en el pliego).

---

## Limitaciones conocidas

- **Importaciones muy grandes.** Todo el trabajo ocurre dentro de una petición HTTP.
  Un libro de 103 filas tarda menos de un segundo, pero uno de decenas de miles
  podría superar el límite de tiempo de Render (~100 s). La solución prevista es un
  worker en segundo plano con el estado en `ImportBatch`, que ya está preparado para
  ello (`status`, `processingStartedAt`, `processingFinishedAt`).
- **`next-auth` está en beta.** La versión 5 solo existe como `5.0.0-beta.32`. Es la
  que soporta App Router; la 4 no es compatible con Next.js 16.
- **El archivo de referencia es `.xls` legacy.** ExcelJS no puede leerlo; por eso el
  parser es SheetJS. Cualquier cambio de librería debe comprobar este punto primero.

---

## Versionado de dependencias

Las versiones críticas están fijadas a propósito:

| Paquete | Versión | Motivo |
|---|---|---|
| `prisma` / `@prisma/client` | `7.10.0` | El tag `latest` de `prisma` apunta hoy a `8.0.0-rc.19`, un *release candidate*. |
| `vitest` | `4.x` | La 5 exige Node ≥ 22.12; la 4 funciona en Node 20 y 22. |
| `xlsx` | `0.20.3` (CDN oficial) | La `0.18.5` publicada en npm arrastra vulnerabilidades conocidas, y aquí se procesan archivos subidos por usuarios. |
| `next-auth` | `5.0.0-beta.32` | Única versión compatible con App Router. |

---

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm start` | Servidor de producción |
| `npm run typecheck` | Comprobación de tipos |
| `npm run lint` | ESLint |
| `npm test` | Pruebas |
| `npm run test:coverage` | Pruebas con informe de cobertura |
| `npm run verify` | Verificación de la importación contra la base de datos |
| `npm run db:migrate` | Crea y aplica una migración (desarrollo) |
| `npm run db:deploy` | Aplica migraciones pendientes (producción) |
| `npm run db:status` | Estado de las migraciones |
| `npm run db:seed` | Datos iniciales |
| `npm run db:studio` | Interfaz visual de la base de datos |

---

## Documentación

| Documento | Qué contiene |
|---|---|
| `docs/progreso-auditoria.md` | Estado de la auditoría, decisiones tomadas y brecha de cobertura |
| `docs/diagramas.md` | Flujo del importador y modelo de datos (Mermaid) |
| `docs/openapi.yaml` | Especificación OpenAPI de la API |
| `docs/operacion.md` | Rotación de credenciales, reinicio de 2FA y copias de seguridad/restauración de Neon |
| `docs/plan-de-trabajo.md` | Plan original del proyecto |
| `docs/reference/FORMATOS.md` | Formato de los libros del Portal de Transparencia |

### Descargas de libros

En **Fuentes y cobertura** cada versión ofrece un extracto público Excel `.xlsx`
y el CSV compatible con la API existente (`?formato=xlsx` selecciona Excel).
Ambos respetan las columnas públicas. El Excel conserva identificadores como texto,
incluidos sus ceros iniciales, y no convierte texto en fórmulas.

En **Administración → Importaciones → Original** un administrador con permiso
`imports:write` puede habilitar o retirar la descarga del archivo original por lote.
Para habilitarla debe revisar todas las hojas y columnas y confirmar que su contenido
puede publicarse íntegramente. Las columnas restringidas impiden la descarga incluso
si el original se publicó antes de cambiar la visibilidad. Se verifica el SHA-256
antes de publicar y en cada descarga; los bytes originales no se modifican.

Los títulos y nombres de descarga incluyen tipo de órdenes, mes, año, municipalidad
(configurada en el portal) y versión. Se conserva el nombre del archivo recibido como
referencia de procedencia. No hay migración de base de datos: la autorización por libro
se guarda en `AppSetting` y sus cambios quedan auditados.

Los originales requieren almacenamiento persistente (`STORAGE_LOCAL_DIR` en el disco
montado de Render). Un archivo perdido tras un despliegue no puede recuperarse a partir
del extracto; debe restaurarse desde la fuente. La descarga devuelve un aviso cuando
el original no está disponible o no coincide con su huella.

### Inventario y cobertura de fuentes

`/fuentes` lista todos los libros registrados, incluidos los cargados sin importar,
los que están en proceso, los fallidos y las versiones anteriores. Ofrece filtros
por año, mes y tipo y paginación de 12 libros consultada en la base de datos. La cifra
de órdenes por libro cuenta los registros realmente importados. Las descargas de
extractos se muestran únicamente en importaciones completadas.

La cobertura mensual distingue archivo ausente, archivo cargado e importación
completada. No exige una segunda aprobación ni interpreta la falta de una declaración
de integridad como ausencia del libro. Un libro importado no garantiza que el mes
contenga todas sus órdenes. Las decisiones sobre duplicados y observaciones se toman
en la importación; esta vista no cambia el cálculo de totales ni activa versiones.

### Administración: carga masiva y perfiles privados

La carga por lotes admite **50 archivos**, de hasta 25 MB cada uno, conservando la
concurrencia limitada y la revisión de duplicados/observaciones de cada libro.

En **Importaciones → Eliminar todas las importaciones**, un ADMIN o SUPERADMIN
puede retirar todos los libros y sus órdenes, hallazgos, columnas, resúmenes y
originales. Se exige la frase `ELIMINAR TODAS LAS IMPORTACIONES` y una confirmación
final. El servidor comprueba que el inventario no cambió y bloquea el borrado si hay
procesos activos; los procesos caducados siguen la política compartida de 10 minutos.
La eliminación de datos es transaccional y queda auditada. Los archivos se retiran
tras confirmar la transacción; los fallos de limpieza se informan. Los proveedores,
fichas privadas, fotos, personas y vínculos se conservan. No se ejecuta ningún borrado
al desplegar este cambio.

En **Perfiles de proveedores** se busca en vivo desde tres caracteres por nombre,
RUC o DNI. Cada proveedor existente tiene una ficha editable; no se duplican sus
identificadores. Un RUC 10 de 11 dígitos permite mostrar sus ocho dígitos centrales
como DNI (`10 + DNI + verificador`); un RUC 20 no genera un DNI personal.

Las fichas permiten registrar lugar de nacimiento/origen, dirección actual, notas,
foto y hasta **10 personas vinculadas**, con DNI, nombre, tipo de relación y fuente
opcional. No se deduce un parentesco a partir de un DNI. Se guardan en tablas privadas
separadas de las personas publicadas. Lectura: `persons:read`; edición: `persons:write`.
Las modificaciones de datos/fotos se auditan y las ediciones obsoletas se rechazan.
Los perfiles también se conservan al borrar individualmente la última importación.

Las fotos JPEG/PNG/WebP, de hasta 2 MB y 16 millones de píxeles, se decodifican,
orientan y convierten a WebP de hasta 1200 px, sin metadatos EXIF. Las fotos nuevas se guardan en Cloudinary y solo se sirven mediante una API autenticada
con caché privada desactivada. Las fotos locales anteriores siguen siendo legibles
si existe su archivo en `STORAGE_LOCAL_DIR/private-profiles`.
La migración `20261007142500_supplier_private_profiles` crea las fichas y sus contactos.

### Fotos de proveedores en Cloudinary (Render)

En Render → Environment configura `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y
`CLOUDINARY_API_SECRET`. Tras el despliegue, todas las fotos nuevas se suben a Cloudinary:
no se guardan en el disco de Render y no hay fallback silencioso al almacenamiento local.
Las credenciales no se envían al navegador. No necesitas un upload preset.

La aplicación usa la API HTTPS firmada con SHA-256 y el tipo `authenticated`, en
`fiscalizador/private-profiles`, con identificadores aleatorios que no incluyen DNI ni RUC.
La consulta pasa por `/api/admin/proveedores/[id]/foto`, valida `persons:read` y descarga
el archivo mediante una petición firmada de corta vigencia, sin publicar la URL de Cloudinary.
Sustituir o retirar una foto elimina el recurso anterior después de confirmar la ficha;
si falla el guardado en la base se intenta retirar el recurso nuevo.

Mantén `STORAGE_DRIVER=local`: esta variable corresponde a los libros originales,
y su driver Cloudinary aún no está implementado. Las fotos usan Cloudinary de forma
independiente. No se requiere migración de base de datos; `photoKey` identifica el destino.
Las fotos locales antiguas se pueden sustituir desde la ficha para guardarlas en Cloudinary;
este despliegue no migra automáticamente archivos anteriores ni recupera archivos perdidos.

### Búsqueda en vivo

La portada muestra hasta cinco coincidencias públicas mientras se escribe, sin salir del campo. Los buscadores de los listados públicos y del administrador consultan automáticamente desde tres caracteres, con una espera de 350 ms. Borrar el texto restaura el listado; los filtros y el orden se conservan, y cada nueva búsqueda vuelve a la primera página. Los formularios GET siguen funcionando con el botón Buscar/Filtrar y sin JavaScript. Las sugerencias de portada no incluyen fichas privadas.
