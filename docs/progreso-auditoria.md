# Auditoría del portal: progreso

Este documento guarda **en qué punto va la auditoría** que se está aplicando al portal,
para poder retomarla desde cualquier máquina sin depender de la memoria de una sesión.
Se actualiza al cerrar cada tarea.

## Cómo se está trabajando

- Los cambios se hacen **directamente en el repositorio** (no se pegan archivos sueltos).
- Al cerrar cada tarea se ejecuta `npm run typecheck`, `npm run lint`, `npx vitest run` y
  `npm run build`, y **se para** para que el responsable confirme antes de seguir.
- Cada tarea va en su propio commit, en pasado y explicando el porqué.

### Entorno (importante)

- **El CLI de Prisma necesita Node 22.** Con el Node 20 del entorno, `npx prisma …` muere
  con `ERR_REQUIRE_ESM` (no puede `require()` de `zeptomatch`). Se resuelve con:
  `export PATH="/nix/store/l85fis49agvp5q1ild1rfh4rrgmn92sr-nodejs-22.21.1/bin:$PATH"`.
  `npm run typecheck`, `npm run lint` y `npx vitest run` funcionan con el Node 20.
- **La base es la de producción** (Neon). Las migraciones se aplican con
  `npx prisma migrate deploy` y se comprueban después contra `_prisma_migrations`.
- Las pruebas que contrastan cifras **se saltan solas** salvo que la base contenga
  únicamente el libro de referencia, y las que eligen proveedores reales se saltan si no
  hay ninguno: no fallan por tener datos distintos.

## Estado

| # | Tarea | Estado |
|---|---|---|
| 1 | Publicación segura de personas señaladas | **Hecha**, pendiente de revisión |
| 2 | Canal real de corrección | Siguiente |
| 3 | Login: límite de intentos y auditoría de fallos | Pendiente |
| 4 | Importador: atomicidad y recuperación | Pendiente |
| 5 | Cabeceras de seguridad | Pendiente |
| 6 | Calidad y operación | Pendiente |

## 1. Publicación segura de personas (hecha)

Commit `bd04744`. Qué cambió y **qué decisiones quedaron tomadas**, para no volver a
discutirlas:

- `Person.isPublic` pasa a `@default(false)`. La migración solo cambia el valor por
  defecto y añade dos columnas nullable: **no toca ninguna fila existente**.
- Una ficha se publica solo si cumple **las tres**: está publicada, tiene una **fuente
  concreta** (mínimo `MINIMO_FUENTE = 12` caracteres, validado en el servicio) y señala a
  **algún proveedor** (deducido del RUC o declarado a mano).
- `verifiedAt` se sella **al publicar** (transición de oculta a publicada). Editar una
  ficha ya publicada **no** reinicia la fecha; ocultarla y volver a publicarla **sí**.
- `sourceUrl` es opcional y, si viene, tiene que empezar por `http://` o `https://`.
- El detalle de la etiqueta separa `deducidos` (DNI dentro del RUC) de `declarados` (a
  mano), y la página pública lo dice fila a fila. El aviso legal **no** se tocó; el badge
  «declarado» de las fichas pasó a «afirmación de la administración» para no confundirlo
  con el origen del vínculo.
- **La migración ya está aplicada** a la base de producción
  (`20261005230325_publicacion_segura_personas`, aplicada el 2026-10-05 a las 23:05).
- Comprobado en la base: `isPublic` queda con defecto `false` y las columnas `sourceUrl` y
  `verifiedAt` creadas. La base tenía **0 personas**, así que «no altera filas existentes»
  no se pudo comprobar con datos, solo por construcción del SQL.

**Pendiente de decisión** (preguntado al cerrar la tarea): el mínimo de 12 caracteres, y
que la fecha de la fuente se muestre con hora (`formatearFechaHora`, porque
`formatearFecha` fuerza UTC y un `DateTime` se vería un día antes en Perú).

## 2. Canal real de corrección (siguiente)

- En `/metodologia`, una sección «Cómo solicitar una corrección o rectificación»: qué
  datos enviar (ficha o proveedor afectado, qué se considera incorrecto, evidencia).
- El correo se lee de `NEXT_PUBLIC_CONTACTO_CORRECCIONES`. **Sin valor por defecto
  inventado**: si no está definida, mostrar un aviso claro de que falta configurarla.
- Plazo de respuesta como constante fácil de cambiar.
- Documentar la variable en `README.md` y en `render.yaml` con `sync: false`.

## 3. Login: límite de intentos y auditoría de fallos

- Limitador **persistente en PostgreSQL** (tabla `LoginAttempt`: clave, contador, ventana,
  bloqueo hasta). Nada de memoria del proceso ni de Redis.
- Límite por correo (normalizado a minúsculas) y por IP. Propuesta: 5 fallos en 15
  minutos bloquean 15 minutos.
- El mensaje al usuario sigue siendo genérico (no revela si el correo existe ni si está
  bloqueado) y el tiempo de respuesta no debe delatarlo: mantener el hash señuelo.
- Registrar en `AuditLog` los fallos (`LOGIN_FAILED`) y los bloqueos, sin contraseña ni
  datos sensibles. Añadir las acciones nuevas a `AuditActionValue` y, si el campo es un
  enum en base, a la migración. Resetear el contador tras un login correcto.
- Para la IP, tomar el valor **más fiable** detrás del proxy de Render y documentar la
  limitación; no presentarlo como a prueba de falsificación.

## 4. Importador: atomicidad y recuperación

- En `confirmar()`, sustituir el patrón leer-estado-luego-actualizar por una transición
  atómica con `updateMany` condicionado al estado; si `count !== 1`, lanzar el
  `ErrorDeNegocio` que toque («ya se está procesando» / «ya fue importado»).
- Considerar `PROCESSING` **caducado a los 10 minutos** (`processingStartedAt`), para que
  `confirmar` pueda reintentarlo y `eliminarImportacion` pueda borrarlo. Registrar la
  recuperación en la auditoría.
- En `analizar()`, manejar la colisión de la restricción única
  `(year, month, importType, version)`: reintentar una vez recalculando la versión, o
  devolver un `ErrorDeNegocio` claro. **Nunca un 500.**

## 5. Cabeceras de seguridad

- `next.config.ts` con `headers()`: `Content-Security-Policy` compatible con Next.js y con
  `res.cloudinary.com` para imágenes, `frame-ancestors 'none'` / `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` restrictivo y `Strict-Transport-Security`.
- Avisar de si algo puede romper recharts, `next/image` o los estilos.

## 6. Calidad y operación

- `.github/workflows/ci.yml`: en cada push y pull request, Node 22, `npm ci`,
  `npm run typecheck`, `npm run lint`, `npm test`. Sin secretos: si `lib/env.ts` exige
  variables al importarse, valores ficticios solo para el paso de pruebas.
- `.env.example` con todas las variables de `lib/env.ts` y las nuevas, sin valores reales,
  y `.gitignore` con `!.env.example`.
- En `auth.config.ts`, cambiar `trustHost: true` por la lectura de `AUTH_TRUST_HOST` solo
  si se puede garantizar que el login en producción sigue funcionando; si no, dejarlo y
  documentar por qué.
- En `services/auditService.ts`, dejar claro en el comentario de `contextoDePeticion` que
  la IP es orientativa.

## Reglas que no se deben romper

- No tocar el cálculo de montos (`statisticsService.ts`) ni los catálogos.
- No añadir dependencias salvo que sea imprescindible, y justificarlo.
- No inventar correos, URLs, nombres ni datos de prueba reales: datos ficticios evidentes.
- No debilitar ningún control de permisos.
- Nada de `queryRawUnsafe`, `dangerouslySetInnerHTML` ni secretos en el repositorio.
