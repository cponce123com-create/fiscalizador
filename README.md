<div align="center">

![Fiscalizador · San Ramón — Compras públicas, datos conectados](docs/assets/fiscalizador-banner.svg)

# Fiscalizador · San Ramón

**Compras públicas, datos conectados y vigilancia ciudadana.**

Transforma libros de órdenes de compra y servicio en información consultable,
con fuentes, historial y cruces documentados.

[![CI](https://github.com/cponce123com-create/fiscalizador/actions/workflows/ci.yml/badge.svg)](https://github.com/cponce123com-create/fiscalizador/actions/workflows/ci.yml)
![Next.js 16](https://img.shields.io/badge/Next.js-16-111827?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-estricto-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-datos-4169E1?logo=postgresql&logoColor=white)
![Node.js 22](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)

[**Explorar el portal ↗**](https://fiscalizador.onrender.com) ·
[**Metodología**](https://fiscalizador.onrender.com/metodologia) ·
[**Documentación**](#documentación) ·
[**Instalación**](#instalación-local)

</div>

---

## El proyecto

Fiscalizador organiza las compras publicadas de la Municipalidad Distrital de San Ramón
para consultar quién contrata, por cuánto, en qué periodo y con qué respaldo documental.
Es una herramienta de **vigilancia ciudadana independiente**.

Los archivos Excel son la fuente de importación. PostgreSQL conserva los registros
normalizados y alimenta las consultas, los rankings y las estadísticas. Cada importación
mantiene su procedencia y el archivo original para revisar los datos.

> Una orden registrada no acredita un pago. Una coincidencia de identidad, una relación
> documentada o una participación electoral aporta contexto para fiscalizar; por sí sola
> no demuestra sobrevaloración, nepotismo ni conflicto de intereses.

## Qué puedes hacer

| Portal ciudadano | Panel administrativo |
| :--- | :--- |
| Buscar órdenes y proveedores en vivo desde tres caracteres. | Analizar hasta **50 libros** por tanda y revisar cada uno antes de importar. |
| Consultar montos, ranking, historial por gestión y estadísticas. | Detectar duplicados, corregir columnas y excluir filas observadas. |
| Revisar libros, versiones y cobertura mensual de las fuentes. | Gestionar catálogos, importaciones y eliminación individual o masiva. |
| Descargar extractos Excel/CSV y originales autorizados. | Mantener perfiles de proveedores y fotografías en Cloudinary. |
| Explorar antecedentes electorales y vínculos habilitados para publicación. | Registrar participaciones electorales y unificar fichas tras verificar identidad. |
| Consultar clima estimado local y el último tipo de cambio publicado. | Administrar roles, publicación por dato y acceso con verificación en dos pasos. |

El contexto de portada utiliza **Open-Meteo** para el clima y series **BCRP/SBS** para
el tipo de cambio. Muestra la fecha del dato disponible; no es una cotización en tiempo real.
La consulta del BCRP admite hasta 12 segundos y reutiliza respuestas validadas durante
15 minutos por proceso. Ante un fallo temporal conserva la última consulta correcta
hasta 24 horas, con la fecha original visible; sin un dato previo muestra indisponibilidad.
Esa reserva es temporal en memoria y se pierde al reiniciar el servicio. Las respuestas
sin dólar no se cachean en el navegador o CDN y la fuente se vuelve a intentar después de 30 segundos.
La lectura admite el JSON válido inicial si el BCRP añade avisos HTML al final;
las cotizaciones y fechas se validan antes de publicar. Los indicadores reintentan
automáticamente cuando falta una fuente y se actualizan cada 15 minutos si ambas responden.

### Búsqueda por relevancia y experiencia móvil

Con texto de búsqueda, el orden predeterminado prioriza identificadores exactos
(orden, RUC o SIAF), frases completas en la descripción, palabras completas,
fragmentos y otras coincidencias, **antes de paginar**. Buscar `iPad` muestra primero
las órdenes que contienen `IPAD`, por delante de coincidencias parciales como
`EQUIPADO`, aunque estas sean más recientes.

La portada y el listado comparten el algoritmo, que normaliza mayúsculas, tildes y
separadores. Los filtros se conservan y se puede elegir otro orden explícitamente.
Sin texto de búsqueda se mantiene el orden por fecha. PostgreSQL calcula y actualiza
la descripción normalizada sin modificar el texto original; no es necesario reimportar
los libros. La migración de esta columna almacenada puede reescribir o bloquear
temporalmente la tabla de órdenes durante el despliegue.

En móvil, el portal utiliza navegación desplegable, controles de al menos 44 px,
campos de 16 px, tarjetas de proveedores y ranking, y paginación abreviada. Las
coincidencias se resaltan con contexto. En escritorio se mantienen las tablas;
la navegación administrativa permite desplazamiento horizontal.

## Tecnología

| Capa | Herramientas |
| :--- | :--- |
| Aplicación | Next.js 16 · App Router · React 19 · TypeScript |
| Interfaz | Tailwind CSS 4 · Lucide · Recharts |
| Datos | PostgreSQL · Prisma 7 · driver adapter `pg` · Neon |
| Autenticación | Auth.js / NextAuth 5 beta · Argon2id · TOTP |
| Importación y validación | SheetJS 0.20.3 · Zod 4 · SHA-256 |
| Fotografías | Cloudinary · Sharp · recursos `authenticated` |
| Calidad y despliegue | Vitest 4 · ESLint · GitHub Actions · Render |

Las versiones resueltas están en [package-lock.json](package-lock.json).
`npm ci` reproduce esa instalación. SheetJS se obtiene del CDN indicado en
[package.json](package.json), no del registro de npm.

## Instalación local

Necesitas **Node.js 22**, npm y una base PostgreSQL de desarrollo separada de producción.

**1. Clona el repositorio y prepara el entorno.**

```bash
git clone https://github.com/cponce123com-create/fiscalizador.git
cd fiscalizador
cp .env.example .env
openssl rand -base64 32
```

Completa `.env` con `DATABASE_URL`, `DIRECT_URL` y el secreto generado para
`AUTH_SECRET`. Para crear la primera cuenta, configura también
`SEED_SUPERADMIN_EMAIL` y una contraseña de al menos 12 caracteres en
`SEED_SUPERADMIN_PASSWORD`.

**2. Instala, aplica las migraciones existentes e inicia.**

```bash
npm ci
npm run db:deploy
npm run db:seed
npm run dev
```

Abre [localhost:3000](http://localhost:3000) y el
[acceso administrativo](http://localhost:3000/admin/login).
El seed prepara los catálogos y crea el superadministrador cuando se definen sus variables.

Configura el entorno **antes de `npm ci`**: su `postinstall` genera el cliente Prisma.
Utiliza `npm run db:migrate` únicamente cuando necesites crear una nueva migración
durante el desarrollo.

## Configuración

La plantilla completa está en [.env.example](.env.example). No publiques `.env`
ni credenciales en el repositorio.

| Variable | Uso |
| :--- | :--- |
| `DATABASE_URL` | Conexión de la aplicación; con pooling en Neon. |
| `DIRECT_URL` | Conexión directa que utiliza la CLI de Prisma. |
| `AUTH_SECRET` | Secreto de al menos 32 caracteres para sesiones y cifrado del secreto TOTP. |
| `SEED_SUPERADMIN_EMAIL`, `SEED_SUPERADMIN_PASSWORD` | Alta inicial de la cuenta administrativa. |
| `STORAGE_DRIVER` | Mantener en `local` para los libros originales. |
| `STORAGE_LOCAL_DIR` | Directorio escribible; en Render debe estar en un disco persistente. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Credenciales de servidor para subir y consultar fotografías. |
| `NEXT_PUBLIC_SITE_URL` | URL pública para enlaces canónicos y metadatos. |
| `NEXT_PUBLIC_MUNICIPALIDAD` | Nombre de la municipalidad mostrado en el portal. |
| `NEXT_PUBLIC_CONTACTO_CORRECCIONES` | Correo público para solicitar correcciones. |
| `TEST_DATABASE_URL` | Base desechable y separada para pruebas de integración locales. |
| `TRUSTED_PROXY_HOPS` | Saltos de proxy verificados para resolver la IP; valor predeterminado `0`. |

Las variables `NEXT_PUBLIC_*` son visibles en el navegador y se incorporan durante
la compilación. **Nunca deben contener secretos.**

### Cloudinary y archivos originales

Las fotografías nuevas usan Cloudinary de manera independiente de `STORAGE_DRIVER`.
No necesitan un upload preset. Se procesan con Sharp, se convierten a WebP y se
retiran los metadatos EXIF; se admiten JPEG, PNG y WebP de hasta 2 MB.

Los recursos se guardan como `authenticated`. El portal los sirve mediante rutas
que comprueban permisos o la política de publicación de la ficha, sin revelar las
credenciales ni la URL firmada de Cloudinary.

En **Admin → Apariencia y titulares** se pueden subir, previsualizar, sustituir y
retirar el logo, favicon, fotografía de portada e imagen para compartir enlaces.
Estas imágenes del portal son públicas y se alojan en una carpeta independiente
de las fotos protegidas de proveedores. Admiten JPEG, PNG y WebP de hasta 5 MB;
el favicon se convierte a PNG de 256 × 256 px y la imagen social a 1200 × 630 px.
La portada exige lugar y crédito. Cada tarjeta se publica con su propio botón,
sin tener que pegar URLs ni configurar un upload preset. Al retirar el logo o
favicon se recupera el recurso predeterminado. No se requiere migración de datos.

Los **libros originales siguen en almacenamiento local**: el driver Cloudinary
para libros no está implementado. Un disco efímero pierde esos archivos al desplegar;
Cloudinary para fotos no sustituye el volumen de originales.

## Cómo se procesan los datos

**1. Analizar → 2. Revisar → 3. Confirmar → 4. Consultar**

1. **Analizar.** Se conserva el archivo, se calcula su huella y se detectan columnas,
   periodo, errores, observaciones y duplicados. Esta fase registra el lote y su
   análisis; todavía no incorpora órdenes a las consultas públicas.
2. **Revisar.** El administrador ajusta el periodo y el mapeo, decide sobre
   observaciones y excluye filas. Las filas con errores que impiden crear una orden
   no se pueden confirmar.
3. **Confirmar.** El servidor relee el original y guarda proveedores, órdenes,
   resúmenes y auditoría en una transacción. El navegador envía decisiones,
   no registros normalizados. La omisión de duplicados está activada por defecto.
4. **Consultar.** Los listados utilizan datos de PostgreSQL. La cobertura distingue
   archivo ausente, cargado e importado; una importación no garantiza integridad mensual.

Los montos usan `Decimal(14,2)` y comprobaciones en centavos. Un monto ilegible se
conserva como texto y `null`, nunca se convierte en cero. Los estados del catálogo
determinan qué suma al **monto considerado**. Las fechas de las órdenes se formatean en UTC.

### Descargas y trazabilidad

Los extractos públicos están disponibles en Excel y CSV. Sus nombres incluyen tipo,
mes, año, municipalidad y versión, conservando el nombre recibido como procedencia.
Los identificadores del Excel se mantienen como texto.

Un original se publica solo tras la autorización administrativa del libro y la
revisión de todas sus hojas y columnas. Las columnas restringidas impiden descargarlo;
su SHA-256 se comprueba al publicar y al descargar. Un extracto no permite reconstruir
un original perdido.

### Identidades y antecedentes

El registro electoral conserva varias candidaturas, periodos y resultados dentro de
una ficha. Los nombres normalizados proponen posibles duplicados: la unión requiere
confirmación administrativa y rechaza documentos contradictorios. Los enlaces de
las fichas incorporadas redirigen al perfil conservado.

El cruce automático con proveedores exige documento exacto en RUC 10.
**Un nombre parecido no acredita identidad ni parentesco.** Los resultados preliminares
se muestran separados del resultado oficial y requieren su fuente.

## Publicación y seguridad

- **Publicación por ficha y por dato.** DNI completo, edad, nacimiento, distrito y
  foto requieren habilitación y fuente pública revisada. Cambiar la foto retira su
  publicación hasta revisar la nueva. Notas y vínculos tienen controles independientes.
- **Datos de contratación.** El RUC y las órdenes permanecen públicos. Ocultar la
  etiqueta DNI no anonimiza un RUC 10; su publicación se gestiona deliberadamente.
- **Acceso administrativo.** Contraseñas Argon2id, permisos comprobados contra la
  base en cada petición, límites de intentos y 2FA con códigos de recuperación y
  rechazo de reutilización TOTP.
- **Protección de consultas.** Exportaciones: hasta 2 peticiones activas y 20 por
  minuto; búsqueda: 3 activas y 180 por minuto, por proceso. El exceso devuelve
  `429` con `Retry-After`. Varias instancias requieren un contador distribuido.
- **Importaciones acotadas.** Se limitan los bytes reales del formulario antes del
  análisis multipart: 25 MB por archivo más 64 KB de sobrecarga.
- **Operación verificable.** La rotación de credenciales, recuperación de 2FA y
  restauración de datos se describen en la [guía de operación](docs/operacion.md).
  El repositorio no confirma que se hayan rotado credenciales previamente expuestas.

| Rol | Alcance |
| :--- | :--- |
| `SUPERADMIN` | Administración completa, usuarios y configuración. |
| `ADMIN` | Gestión de datos, importaciones y vínculos. |
| `EDITOR` | Mantenimiento de datos existentes; sin importación ni publicación de vínculos. |
| `VIEWER` | Consulta administrativa; sin acceso al registro de personas. |

## Calidad y pruebas

```bash
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run build
```

Sin `TEST_DATABASE_URL`, las pruebas locales ejecutan las unidades y omiten las
integraciones. **No cargan automáticamente la conexión de `.env`.** Para integrar,
prepara una base desechable, aplica migraciones y seed en esa base y proporciona su
conexión como `TEST_DATABASE_URL`.

[GitHub Actions](.github/workflows/ci.yml) utiliza PostgreSQL 16 temporal y verifica
tipos, lint, migraciones, pruebas con cobertura y compilación.
El [libro de referencia](docs/reference/FORMATOS.md) permite contrastar el importador
con un formato real. `npm run verify` escribe datos: ejecútalo solo en una base de verificación.

## Despliegue en Render

El [blueprint](render.yaml) configura Node 22, compilación, migraciones, health check
en `/api/health` y disco persistente en `/var/data` para los originales.

1. Conecta el repositorio mediante el blueprint y configura las conexiones y secretos.
2. Añade las tres variables de Cloudinary si utilizarás fotografías y comprueba el
   nombre de la municipalidad y el canal público de correcciones.
3. En una base nueva, ejecuta el seed para preparar catálogos y la primera cuenta.
4. Comprueba `/api/health`, el acceso administrativo, una importación y sus descargas.

El blueprint declara el plan `starter` y `STORAGE_LOCAL_DIR=/var/data/uploads`.
`npm start` también aplica las migraciones pendientes antes de iniciar Next.js.
La configuración de desarrollo y pruebas debe usar bases separadas de producción.

## Arquitectura y comandos

| Directorio | Responsabilidad |
| :--- | :--- |
| [`app/`](app/) | Páginas, rutas públicas, panel y endpoints. |
| [`components/`](components/) | Interfaz pública, administrativa y componentes comunes. |
| [`services/`](services/) | Importación, validación, estadísticas, identidad y almacenamiento. |
| [`lib/`](lib/) | Autenticación, entorno, acceso a datos y utilidades compartidas. |
| [`prisma/`](prisma/) | Esquema, migraciones y datos iniciales. |
| [`tests/`](tests/) | Configuración y soporte de pruebas. |
| [`scripts/`](scripts/) | Verificación y administración operativa. |

| Comando | Propósito |
| :--- | :--- |
| `npm run dev` | Desarrollo local. |
| `npm run build` / `npm start` | Compilar / aplicar migraciones e iniciar en producción. |
| `npm run db:generate` | Regenerar el cliente Prisma. |
| `npm run db:deploy` | Aplicar migraciones existentes. |
| `npm run db:migrate` | Crear migraciones durante el desarrollo. |
| `npm run db:status` / `npm run db:studio` | Revisar migraciones / explorar la base. |
| `npm run db:seed` | Preparar catálogos y la cuenta inicial configurada. |
| `npm run usuarios` / `npm run usuarios:listar` | Administrar / listar cuentas. |

## Documentación

| Documento | Contenido |
| :--- | :--- |
| [Metodología ciudadana](docs/vigilancia-ciudadana.md) | Criterios y contexto de fiscalización. |
| [Operación](docs/operacion.md) | Credenciales, 2FA, copias de seguridad y restauración. |
| [Diagramas](docs/diagramas.md) | Modelo de datos y flujo de importación. |
| [API](docs/openapi.yaml) | Especificación OpenAPI de referencia. |
| [Formatos de origen](docs/reference/FORMATOS.md) | Estructura de los libros y archivo de referencia. |
| [Interfaz ciudadana](docs/interfaz-ciudadana.md) | Criterios de presentación del portal. |
| [Auditoría](docs/progreso-auditoria.md) | Registro histórico de decisiones y comprobaciones. |
| [Requisitos](docs/prompt.md) · [Plan inicial](docs/plan-de-trabajo.md) | Contexto original del proyecto. |

## Mejoras en seguimiento

- Procesamiento de libros grandes en workers; SheetJS todavía ejecuta el análisis de forma síncrona.
- Contadores distribuidos para límites de consultas con varias instancias.
- Revisión de dependencias y evolución de Auth.js 5, que actualmente utiliza una versión beta.
- Consulta RNP con fuente y fecha verificables: no hay un scraper RNP activado. Una
  consulta fallida no equivale a ausencia de registro, ni la vigencia actual a la primera inscripción histórica.

---

<div align="center">

**Fiscalizador · San Ramón**<br>
Fuentes visibles. Datos trazables. Fiscalización con contexto.

</div>
