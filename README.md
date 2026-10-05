# Portal de Transparencia — Órdenes de Compra y Servicio

Aplicación web para consultar y analizar las órdenes de compra (O/C) y de servicio
(O/S) publicadas en el Portal de Transparencia.

El objetivo no es «mostrar un Excel», sino **normalizar, almacenar y consultar**
esos datos desde PostgreSQL. Los libros de Excel son la **fuente de importación**,
nunca la fuente de presentación.

---

## Estado actual

Esta entrega cubre las **Fases 1 a 5** del plan: base del proyecto, modelo de datos
completo, autenticación y el **importador funcionando de extremo a extremo**,
verificado contra el libro real del portal.

**Incluido:** esquema completo, migraciones, seed, autenticación con roles,
importador en dos fases con validación y normalización, auditoría, panel de
administración, tabla de órdenes paginada en servidor y pruebas automatizadas.

**Pendiente (fases posteriores):** dashboard público, ranking de proveedores,
historial por gestiones, fotografías de proveedores en Cloudinary, SEO, asistente
con IA, optimización fina y despliegue.

Documentación relacionada:

| Documento | Contenido |
|---|---|
| [`docs/prompt.md`](docs/prompt.md) | Especificación de requisitos (48 secciones) |
| [`docs/plan-de-trabajo.md`](docs/plan-de-trabajo.md) | Comentario arquitectónico de referencia |
| [`docs/reference/FORMATOS.md`](docs/reference/FORMATOS.md) | Formatos reales del libro fuente, medidos sobre el archivo |

---

## Requisitos

- **Node.js 20 o superior.** El proyecto se desarrolló y verificó con **20.19.1**.
  Para desplegar conviene **Node 22 o superior**: Prisma 7.10 arrastra un paquete
  (`@prisma/streams-local`) que declara Node ≥ 22. En Node 20 funciona, pero emite
  una advertencia de motor.
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
| `CLOUDINARY_*` | No | Credenciales de Cloudinary. Reservadas para la fase de fotografías. |

`.env` está en `.gitignore`. **Nunca se versiona.**

---

## Arquitectura

Una sola aplicación Next.js (App Router). La separación no es por servicios
desplegables, sino **por capas**:

```
app/                     Presentación (páginas y manejadores de ruta)
  admin/(panel)/         Panel autenticado
  admin/login/           Formulario de acceso (fuera del layout protegido)
  api/                   Endpoints HTTP
components/
  admin/                 Componentes del panel
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

### Fase 1 — Analizar (no escribe nada)

`POST /api/admin/imports/analyze`

1. Guarda el archivo original íntegro.
2. Lee el libro con **SheetJS** y detecta la fila de encabezado.
3. Empareja cada columna con un campo interno, por coincidencia exacta, alias o
   similitud, e informa el método y la confianza de cada propuesta.
4. Valida fila por fila y clasifica los hallazgos en **ERROR**, **WARNING** o
   **INFO**.
5. Detecta duplicados: mismo contenido exacto (checksum) o mismo periodo ya
   importado.
6. Devuelve columnas detectadas, resumen, vista previa y hallazgos.

### Fase 2 — Confirmar (una sola transacción)

`POST /api/admin/imports/confirm`

**Relee el archivo guardado en el servidor** y escribe todo de una vez: proveedores,
órdenes, resúmenes por gestión y auditoría. Si algo falla, no queda nada a medias.

El cuerpo de la petición **no lleva filas**, solo el identificador del lote y las
correcciones de mapeo. Es deliberado: si el navegador pudiera enviar las filas ya
normalizadas, podría insertar registros que no existen en el archivo original.

### Reglas de validación

- **RUC:** 11 dígitos y dígito verificador (módulo 11). Formato inválido es ERROR;
  dígito verificador incorrecto es WARNING y el dato se conserva.
- **Montos:** convención `es-PE`. Lo que no se entiende se guarda como `null` con el
  texto original en `rawAmount` y un WARNING, **nunca como cero**.
- **Estados:** se buscan en el catálogo. Un estado desconocido cae en `DESCONOCIDO`,
  se advierte y **no suma** al monto considerado.
- **Duplicados:** nunca se bloquean solos. Se advierten y decide el administrador.

---

## Roles y permisos

| Rol | Alcance |
|---|---|
| `SUPERADMIN` | Todo, incluida la gestión de usuarios y la configuración |
| `ADMIN` | Gestión completa de datos e importaciones. No gestiona usuarios ni configuración |
| `EDITOR` | Mantiene lo ya importado. **No importa**: cargar un libro cambia las cifras públicas |
| `VIEWER` | Solo lectura |

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

`npm test` incluye una prueba que lee el libro real
(`docs/reference/Lista-OCOS-2023-06.xls`) y comprueba que las cifras coinciden
exactamente con las medidas durante el desarrollo:

| Métrica | Valor |
|---|---|
| Órdenes | 103 |
| Proveedores | 72 |
| Monto registrado | `S/ 1.066.136,59` |
| Monto anulado | `S/ 38.994,87` |
| **Monto considerado** | **`S/ 1.027.141,72`** |

Si el importador deja de reproducir estas cifras, la prueba falla. Es la red de
seguridad que impide que un cambio de formato o de redondeo pase desapercibido.

---

## Seguridad

- Contraseñas con **argon2id** (`@node-rs/argon2`, sin compilación nativa).
- Sesiones en cookie `httpOnly`, estrategia JWT, 8 horas.
- El inicio de sesión verifica la contraseña **siempre**, incluso cuando el correo
  no existe, para no filtrar qué cuentas están registradas por diferencia de tiempo.
- Los mensajes de error de la API nunca incluyen detalles internos.
- Toda entrada se valida con Zod en el borde de la API.
- El nombre del archivo subido se usa solo para mostrarlo: la ruta de almacenamiento
  se deriva del checksum, así que no puede usarse para escapar del directorio.

### Puntos a resolver antes de producción

1. **Rotar la contraseña de la base de datos.** La credencial de Neon se compartió en
   claro durante la configuración.
2. **Almacenamiento persistente.** Con `STORAGE_DRIVER=local` los archivos originales
   se guardan en disco. En Render el disco de un servicio web es **efímero**: los
   archivos se perderían en cada despliegue. Hay que usar un volumen persistente o
   Cloudinary (adaptador ya previsto).
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
| `npm run verify` | Verificación de la importación contra la base de datos |
| `npm run db:migrate` | Crea y aplica una migración (desarrollo) |
| `npm run db:deploy` | Aplica migraciones pendientes (producción) |
| `npm run db:status` | Estado de las migraciones |
| `npm run db:seed` | Datos iniciales |
| `npm run db:studio` | Interfaz visual de la base de datos |
