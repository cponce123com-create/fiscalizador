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
| 2 | Canal real de corrección | **Hecha**, pendiente de revisión |
| 3 | Login: límite de intentos y auditoría de fallos | **Hecha**, pendiente de revisión |
| 4 | Importador: atomicidad y recuperación | **Hecha**, pendiente de revisión |
| 5 | Cabeceras de seguridad | **Hecha**, pendiente de revisión |
| 6 | Calidad y operación | **Hecha**, pendiente de revisión |

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

## 2. Canal real de corrección (hecha)

Sección «Cómo solicitar una corrección o rectificación» en `/metodologia`, antes del pie,
con ancla `#correcciones` (la página de vínculos ahora enlaza a ella). Qué se hizo y **qué
decisiones quedaron tomadas**:

- El correo se lee de `NEXT_PUBLIC_CONTACTO_CORRECCIONES` mediante `lib/contacto.ts`
  (`leerContactoCorrecciones`), que devuelve `null` si falta, está vacío o solo tiene
  espacios. **No hay correo por defecto.**
- Si el correo está configurado, la sección muestra un enlace `mailto:` y el plazo de
  respuesta. Si no, muestra un **aviso visible** (`Aviso`, tono advertencia) que nombra la
  variable que falta, en vez de un correo inventado.
- El plazo vive en la constante `PLAZO_RESPUESTA_DIAS` (`lib/contacto.ts`), fácil de cambiar.
  Valor actual: **15 días hábiles**.
- La sección pide, en una lista, qué corregir (ficha o proveedor, nombre/RUC y, si aplica,
  nº de orden), qué es incorrecto, la evidencia y un medio de contacto; y aclara que el
  canal sirve para rectificar contra la fuente, no para denunciar ni para borrar registros.
- Variable documentada en `README.md` (con la nota de que las `NEXT_PUBLIC_` se incrustan en
  el HTML y **no** pasan por `lib/env.ts`), en `render.yaml` (`sync: false`) y en
  `.env.example`. Ojo: `.env.example` sigue **sin versionar**; añadir `!.env.example` es de
  la tarea 6.
- Pruebas: `lib/contacto.test.ts` cubre el correo definido, con espacios, vacío, en blanco y
  ausente, y que el plazo sea positivo.
- Verificado con `npm run typecheck`, `npm run lint`, `npx vitest run` (217 pasan, 74 se
  saltan) y `npm run build`. El HTML estático de `/metodologia` contiene la sección y, al no
  estar la variable definida en este entorno, el aviso de que falta configurarla.

**Pendiente de decisión**: el plazo de 15 días hábiles. Además, el aviso de «falta
configurar» es **público**: si se despliega sin la variable, lo verá el ciudadano; conviene
definirla antes de publicar.

## 3. Login: límite de intentos y auditoría de fallos (hecha)

Tabla `LoginAttempt` (migración `20261006120000_login_intentos`, **ya aplicada** a la base
de producción) y servicio `services/loginThrottleService.ts`. Qué cambió y **qué
decisiones quedaron tomadas**:

- Una fila por clave (`scope` EMAIL/IP + `key`): `count` son los fallos de la ventana en
  curso (`windowStartedAt`) y `blockedUntil` marca hasta cuándo está bloqueada. El conteo
  usa `increment` (atómico) y una ventana caducada se reinicia sola.
- Umbral: **5 fallos en 15 minutos bloquean 15 minutos** (constantes `MAX_FALLOS`,
  `VENTANA_MS` y `BLOQUEO_MS`). Es la propuesta del plan, sin cambios.
- En `authorize` se comprueba el bloqueo **antes** de validar la contraseña. Si está
  bloqueado, se verifica contra el **hash señuelo** y se devuelve `null`: el mensaje y el
  tiempo de respuesta son idénticos a unas credenciales incorrectas, así que un bloqueo no
  se distingue. Una cuenta inactiva también cuenta como fallo.
- Auditoría: cada fallo escribe `LOGIN_FAILED` y, al cruzar el umbral, un `LOGIN_BLOCKED`;
  un intento ya bloqueado deja `LOGIN_FAILED` con `motivo: "bloqueado"`. Nunca se registra
  la contraseña. Las acciones nuevas se añadieron al enum `AuditAction` en la migración y
  al tipo `AuditActionValue`.
- Un inicio correcto llama a `registrarExito`, que borra las filas de sus claves (correo e
  IP); además, la auditoría del `LOGIN` ahora incluye IP y user-agent.
- La IP sale de `X-Forwarded-For` (`contextoDePeticion`). **Es orientativa**: puede
  falsificarse y varias personas pueden compartirla, así que no se presenta como
  infalsificable.
- Pruebas: `services/loginThrottleService.test.ts` (5 casos) contra la base real.
- Verificado además de extremo a extremo contra el build de producción: cinco intentos
  fallidos con un correo ficticio crean el contador y bloquean; el 6.º queda como
  `LOGIN_FAILED (motivo bloqueado)`; se registra un `LOGIN_BLOCKED`; y un inicio correcto
  del SUPERADMIN devuelve sesión, `/admin` responde 200 y el contador queda limpio. La
  migración se comprobó contra `_prisma_migrations` y contra el enum y las columnas reales.

**Pendiente de decisión**: nada nuevo. Recordar que, al limitar por IP, un bloqueo por
fallos desde una IP compartida (oficina, NAT) afecta a todos los que salen por ella; es el
precio de frenar la fuerza bruta y conviene saberlo.

## 4. Importador: atomicidad y recuperación (hecha)

Todo en `services/importService.ts`, sin cambios de esquema. Qué se hizo y **qué
decisiones quedaron tomadas**:

- `confirmar()` ya no lee el estado para luego actualizarlo: reclama el lote con un
  `updateMany` condicionado (`reclamarLote`) que solo pasa a `PROCESSING` desde un estado
  reclamable (VALIDATING, UPLOADED, FAILED) o desde un `PROCESSING` caducado. Si `count`
  no es 1, se relee el estado y se lanza el `ErrorDeNegocio` que toque («ya se está
  procesando» / «ya fue importado»). La guarda previa de estado se mantiene, pero solo
  para dar el mensaje correcto: la que decide es la transición atómica.
- `PROCESSING` **caduca a los 10 minutos** (`PROCESO_CADUCADO_MS`). Un lote colgado se
  puede reanudar con `confirmar` o borrar con `eliminarImportacion`. Un `processingStartedAt`
  nulo cuenta como caducado: dejarlo bloqueado para siempre sería peor. La recuperación
  queda en la auditoría (en `confirmar`, una entrada `UPDATE` con `recuperacion: "proceso
  caducado"`; en el borrado, el campo `recuperadoDeProcesoColgado` de la entrada `DELETE`).
- `analizar()` crea el lote con `crearLoteConVersionLibre`: si el `create` choca con la
  clave única `(year, month, importType, version)` (P2002), recalcula la versión y
  reintenta una vez; si vuelve a chocar, lanza un `ErrorDeNegocio`. **Nunca un 500.**
- Pruebas nuevas en `services/importService.test.ts` (5): recuperación de un lote colgado
  con su auditoría, rechazo de un lote vivo, una sola confirmación gana entre dos
  simultáneas, borrado de un lote colgado, y dos análisis del mismo periodo se reparten
  versiones distintas. Se actualizó la prueba del lote en proceso para que tenga marca de
  inicio reciente.
- Verificado: `npm run typecheck`, `npm run lint`, `npx vitest run` (227 pasan, 74 se
  saltan) y `npm run build`. Comprobado en la base que no queda ningún dato de prueba ni
  ningún lote en `PROCESSING`.

**Pendiente de decisión**: el umbral de 10 minutos para dar por colgado un proceso. El
lote en proceso se recupera por tiempo, así que un proceso legítimo que tardara más de
diez minutos —hoy no ocurre: la transacción tiene tope de dos minutos— podría solaparse
con un reintento.

## 5. Cabeceras de seguridad (hecha)

`next.config.ts` aplica las cabeceras a todas las rutas (`/:path*`). Qué quedó y **qué
decisiones se tomaron**:

- `Content-Security-Policy`: `default-src 'self'`; `script-src 'self' 'unsafe-inline'`
  (Next.js inyecta scripts en línea para arrancar y, sin un `nonce` por petición —que
  obligaría a ampliar el middleware a TODAS las rutas—, no hay otra forma de permitirlos);
  `style-src 'self' 'unsafe-inline'` (Tailwind y recharts pintan estilos en línea);
  `img-src 'self' data: blob: https://res.cloudinary.com`; `font-src 'self' data:`
  (`next/font` sirve las fuentes desde el propio dominio); `connect-src 'self'`;
  `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`.
- `X-Frame-Options: DENY` (para navegadores que no entienden `frame-ancestors`),
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` con cámara, micro, geolocalización, pago, USB, sensores y Topics
  cerrados, y `Strict-Transport-Security: max-age=63072000; includeSubDomains`.
- En **desarrollo** se añaden `'unsafe-eval'` y el WebSocket del recargado en caliente,
  que Turbopack necesita; en producción, no. **No** se envía `upgrade-insecure-requests`:
  HSTS ya fuerza HTTPS en producción y la directiva rompería la prueba local del build
  sobre HTTP.
- **Aviso de posibles roturas**: `recharts` y Tailwind quedan cubiertos por
  `style-src 'unsafe-inline'`; `next/image` sirve las imágenes optimizadas desde el propio
  dominio y Cloudinary queda permitido para las que se sirvan directas; las fuentes de
  `next/font` son del propio dominio. Lo único que rompería sería añadir un script, estilo,
  fuente o imagen de un dominio nuevo: habría que abrirlo aquí.
- Verificado contra el build de producción servido en local: las seis cabeceras llegan en
  `/` y en `/admin/login`, el portal responde y su CSS y su JS se sirven desde el mismo
  origen (200). No se pudo comprobar en un navegador real (no hay uno disponible en este
  entorno), así que la ausencia de violaciones de CSP en el cliente queda razonada, no
  medida.

**Pendiente de decisión**: nada nuevo. La CSP mantiene `'unsafe-inline'` en scripts porque
no hay nonce; endurecerla exigiría generar el nonce en el middleware y aplicarlo a todas
las rutas.

## 6. Calidad y operación (hecha)

- `.github/workflows/ci.yml`: en cada push y pull request, Node 22, `npm ci`,
  `npm run typecheck`, `npm run lint`, `npm run db:deploy && npm run db:seed` y `npm test`.
  Se añadió un **PostgreSQL 16 efímero** como servicio: los valores ficticios del plan no
  bastaban, porque las pruebas de integración se ejecutan en cuanto `DATABASE_URL` existe y
  fallarían al no poder conectar. Con un Postgres de verdad se ejecutan de verdad, y las que
  necesitan datos del portal se saltan solas. No hay secretos: el contenedor vive y muere con
  el job y `AUTH_SECRET` es ficticio.
- `.env.example` con todas las variables de `lib/env.ts` (se añadió `STORAGE_LOCAL_DIR` y una
  nota de `NODE_ENV`) más `NEXT_PUBLIC_CONTACTO_CORRECCIONES`, y `.gitignore` con
  `!.env.example`, así que la plantilla ya se versiona.
- `auth.config.ts`: se **deja** `trustHost: true` y se documenta por qué. Moverlo a
  `AUTH_TRUST_HOST` obligaría a definir la variable en Render y, si faltara, el login de
  producción dejaría de funcionar sin avisar; como no se puede garantizar que siga
  funcionando, se mantiene el valor seguro con su explicación.
- `services/auditService.ts`: el comentario de `contextoDePeticion` ahora dice que la IP es
  orientativa (falsificable, compartida tras un NAT) y que solo sirve para la auditoría y el
  límite de intentos, nunca para decidir permisos.
- Verificado: `npm run typecheck`, `npm run lint`, `npx vitest run` (227 pasan, 74 se saltan)
  y `npm run build`. Además se ejecutaron contra la base real `npm run db:deploy` (sin
  migraciones pendientes) y `npm run db:seed` (idempotente), que son los pasos que añade el
  CI, y el workflow se validó como YAML. **No** se pudo ejecutar el CI completo contra un
  Postgres recién creado: en este entorno no hay PostgreSQL ni Docker.

**Pendiente de decisión**: nada nuevo. Queda sin verificar en un runner real que la suite esté
entera en verde sobre una base recién sembrada; se apoya en que las pruebas están escritas
para pasar en una base vacía (varias se siembran sus propios datos).

## Reglas que no se deben romper

- No tocar el cálculo de montos (`statisticsService.ts`) ni los catálogos.
- No añadir dependencias salvo que sea imprescindible, y justificarlo.
- No inventar correos, URLs, nombres ni datos de prueba reales: datos ficticios evidentes.
- No debilitar ningún control de permisos.
- Nada de `queryRawUnsafe`, `dangerouslySetInnerHTML` ni secretos en el repositorio.
