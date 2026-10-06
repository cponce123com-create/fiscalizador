# Operación

Procedimientos que hay que ejecutar a mano sobre producción. Van aquí, y no en la memoria
de nadie, porque son los que se hacen una vez cada muchos meses y no conviene improvisar.

---

## 1. Rotar la contraseña de Neon

Se rota cuando una credencial se ha expuesto (por ejemplo, si la URL de conexión acabó en
un chat o en un registro) o por higiene periódica.

> El orden importa: si se cambia la contraseña en Neon antes de actualizar Render, el
> portal se queda sin base de datos entre los dos pasos. Es una caída de minutos, no de
> horas, pero se evita cambiando primero en Render... y no se puede: Render necesita el
> valor nuevo. Así que se asume la ventana corta y se hace seguido.

1. **Neon** → proyecto → *Reset password* (o *Roles* → el rol `neondb_owner` → cambiar
   contraseña). Copiar la **connection string** que ofrece.
2. **Render** → servicio `fiscalizador` → *Environment* → actualizar **las dos**
   variables, con `sslmode=verify-full` explícito:
   - `DATABASE_URL` → host **con** `-pooler` (lo usa el runtime).
   - `DIRECT_URL` → host **sin** `-pooler` (lo usan las migraciones).
3. Guardar. Render redespliega solo al cambiar variables de entorno.
4. Verificar:
   - `curl -s https://<host>/api/health` → `{"ok":true,"base":"accesible"}`.
   - Iniciar sesión en `/admin/login`.
   - `npm run db:status` (o `npx prisma migrate status`) contra la base nueva.

Si algo falla, revisar en este orden: que `DIRECT_URL` no lleve `-pooler`, que la
contraseña no tenga caracteres sin codificar en la URL, y el registro de Render.

## 2. Rotar `AUTH_SECRET`

`AUTH_SECRET` firma los JWT de sesión y, además, **deriva la clave con la que se cifran los
secretos TOTP** (ver `lib/auth/secrets.ts`).

> **Dos consecuencias**, no una:
>
> 1. **Todas las sesiones abiertas dejan de ser válidas**: todo el mundo tiene que volver a
>    iniciar sesión.
> 2. **Los secretos de 2FA dejan de poder descifrarse**, así que las cuentas que lo tengan
>    activado tendrán que volver a darlo de alta.
>
> No se pierde ningún dato, pero hay que avisar antes y prever el punto 2: sin eso, esas
> cuentas se quedan fuera del panel.

1. Generar uno nuevo: `openssl rand -base64 32`.
2. **Render** → *Environment* → `AUTH_SECRET` → pegar el valor nuevo → guardar.
3. Render redespliega. Verificar el login.
4. **Rehacer el 2FA de las cuentas administrativas**: cada una entra y lo da de alta otra
   vez en `/admin/2fa`. Si alguna no puede, se le reinicia (sección 5).

## 3. Copias de seguridad de Neon y restauración

Neon guarda un historial de cambios por rama que permite **restaurar a un punto en el
tiempo** (PITR). La ventana de restauración depende del plan: se consulta en el panel
(**Neon → proyecto → Branches → historial**), no se asume.

### Comprobar que hay historial

1. Neon → proyecto → **Branches**.
2. Abrir la rama de producción (`main` o la que use `DATABASE_URL`).
3. Ver la pestaña de **historial / restore**: debe mostrar una ventana con la que se puede
   retroceder. Si el plan no la ofrece, hay que subir de plan o montar un `pg_dump`
   programado.

### Restaurar a un punto en el tiempo (sin tocar producción)

Se restaura **en una rama nueva** y se verifica antes de apuntar el portal a ella.

1. Neon → **Branches** → *New branch* → origen: la rama de producción → **desde un
   instante concreto** (el momento justo antes del incidente).
2. Copiar la connection string de la rama nueva.
3. Verificar la rama restaurada **antes** de usarla:
   ```bash
   # Con la URL de la rama nueva en el entorno:
   npx prisma migrate status        # las migraciones deben estar aplicadas
   ```
   Y una comprobación de datos con una consulta de lectura:
   ```sql
   SELECT COUNT(*) FROM "Order";
   SELECT MAX("createdAt") FROM "AuditLog";
   ```
   Contrastar con lo que se esperaba.
4. Si la restauración es correcta, **cambiar `DATABASE_URL` y `DIRECT_URL` en Render** a la
   rama restaurada (o promoverla como principal desde Neon).
5. Verificar `/api/health`, el login y una página pública con datos.

> Si la rama restaurada quedó en un estado **anterior** a alguna migración, al apuntar el
> portal a ella hay que aplicar las migraciones pendientes: `npm run db:deploy` (usa
> `DIRECT_URL`).

### Nota sobre los archivos originales

Las copias de Neon cubren **la base de datos**, no el disco de Render
(`/var/data/uploads`). Los libros originales importados viven ahí y **no** están en la
copia. Para una recuperación completa hay que conservar también ese volumen (o migrar a
Cloudinary, que es la Fase 11 del plan).

---

## 4. Comprobaciones después de un despliegue

1. `/api/health` → 200 y `{"ok":true,"base":"accesible"}`.
2. `/` → 200 y con cifras (no vacía).
3. `/robots.txt` y `/sitemap.xml` → 200 y con la URL pública correcta.
4. En los registros de arranque, que **no** aparezca `ETIMEDOUT` ni un `No se pudo
   despertar la base de datos`.
5. Iniciar sesión en el panel.

---

## 5. Reiniciar el 2FA de una cuenta (salida de emergencia)

Se usa cuando alguien ha perdido el teléfono **y** los códigos de recuperación, y sin esto
no podría volver a entrar.

```bash
npm run usuarios -- --email admin@example.com --reset-2fa
```

Apaga la verificación en dos pasos de esa cuenta, borra sus códigos de recuperación y
cierra sus sesiones. Al volver a entrar, el panel la llevará a `/admin/2fa` para darla de
alta otra vez.

> Se ejecuta desde un entorno de confianza con acceso a `DATABASE_URL`, **nunca desde el
> panel**: si el panel pudiera hacerlo, a quien le robaran una sesión le bastaría con
> quitarse el segundo factor.

---

## 6. Forzar el cambio de contraseña de una cuenta

Se usa cuando una contraseña la ha conocido alguien más que su dueño: la del seed (viaja
en claro en `SEED_SUPERADMIN_PASSWORD`), las que restablece un administrador, y las
cuentas que ya existían antes de que esto se implementara.

La cuenta sigue entrando con su contraseña actual —hace falta para poder cambiarla— pero
el panel no se abre: el layout la manda a `/admin/cambiar-contrasena`.

```bash
npm run usuarios -- --email <correo> --exigir-cambio
```

El script marca la cuenta **solo** cuando la crea o cuando le pone una contraseña nueva.
Reejecutarlo sin contraseña no toca la marca, y el seed tampoco: reejecutar el seed no
debe resetear ni la contraseña ni la marca de una cuenta en activo.

Orden de las obligaciones al entrar: primero la contraseña y después el alta del segundo
factor. Mientras la contraseña sea la que se compartió, lo urgente es esa.

Si hay que levantar la marca sin pasar por la web (por ejemplo, para desbloquear a alguien
con prisa), `npm run db:studio` y desmarcar la casilla de esa cuenta.

> Ojo: al levantar la marca a mano, la contraseña sigue siendo la que se compartió. Es una
> salida de emergencia, no una alternativa al cambio.

---

## 7. Dependencias con `overrides`

`package.json` fuerza dos versiones de dependencias **transitivas** del CLI de Prisma:

```json
"overrides": {
  "deepmerge-ts": "^8.0.2",
  "mysql2": "^3.24.5"
}
```

Motivo: `prisma@7.10.0` fija `deepmerge-ts@7.1.5` (vulnerable a agotamiento de pila al
fusionar objetos recursivos, `GHSA-ggr8-5vv4-36mx`, rango afectado `<8.0.0`) y
`mysql2@3.15.3` (fuga de credenciales en claro y bomba de descompresión,
`GHSA-3f6p-5ww8-9rcr` y `GHSA-rgwj-5xj2-c3m3`, rango afectado `<=3.23.0`).

**Las dos son del CLI, que es dependencia de desarrollo**: no llegan al runtime de
producción, y el proyecto usa PostgreSQL, así que `mysql2` no se invoca nunca. Aun así
conviene no arrastrarlas, y sobre todo no en la máquina que ejecuta las migraciones.

**Al subir Prisma de versión hay que revisar esto**: si Prisma adopta por su cuenta versiones
ya arregladas, los `overrides` sobran y se pueden quitar. Y al revés: forzar una versión
mayor de una dependencia de otro puede romperlo, así que después de tocar esto hay que
comprobar que el CLI sigue funcionando:

```bash
npx prisma migrate status   # carga prisma.config.ts, que usa @prisma/config
npx prisma generate
npm audit
```

### Lo que los `overrides` NO arreglan

Quedan tres avisos de severidad alta en la cadena de ESLint (`braces`, `micromatch`,
`fast-glob`). Son de **herramientas de lint**, no del producto, y solo se explotan con un
patrón de búsqueda malicioso: aquí los patrones los escribe el propio proyecto, no un
tercero. `npm audit` no propone arreglarlos actualizando esos paquetes, sino **bajando
`eslint-config-next` a 14.2.35**, que en un proyecto con Next 16 es peor el remedio que la
enfermedad. Se dejan como están, a la espera de que Next actualice su cadena.


## Revocación de sesiones administrativas

La migración `20261006211500_revocar_sesiones_jwt` añade `User.sessionVersion`.
Se debe aplicar antes de ejecutar esta versión del servidor (`npm run db:deploy`;
el blueprint de Render ya lo hace en `preDeployCommand`). Los JWT anteriores a
esta actualización carecen de versión y se rechazan: todas las cuentas deberán
iniciar sesión otra vez.

El cambio de contraseña, el restablecimiento por CLI, la desactivación de cuenta,
`--exigir-cambio` y `--reset-2fa` incrementan la versión y revocan los JWT previos.
Tras cambiar la contraseña propia se vuelve al login. Borrar filas de `Session`
solo limpia sesiones persistidas; la revocación de JWT depende de esta versión.

Las API y Server Actions que requieren permisos bloquean también las cuentas con
contraseña pendiente o sin el 2FA obligatorio. El alta de 2FA solo sirve para una
cuenta activa, con contraseña ya cambiada y sin factor existente; no permite
sustituirlo. Si se pierde el factor, se utiliza el procedimiento de rescate por
CLI `--reset-2fa`, que revoca las sesiones antes de permitir una nueva alta.

## Arranque con migraciones pendientes

`npm start` ejecuta `npm run db:deploy` antes de iniciar Next.js. El comando usa la versión de Prisma instalada en el proyecto y `DIRECT_URL`. Si falta configuración, conexión o una migración falla, Next.js no arranca: no se sirve una aplicación cuyo esquema está incompleto. Las migraciones ya aplicadas no se vuelven a ejecutar.

El `preDeployCommand` de Render sigue siendo útil, pero el servicio también queda protegido cuando fue creado manualmente y esa configuración del blueprint no se aplicó. `DIRECT_URL` y `DATABASE_URL` deben apuntar a la misma base de datos; la primera es la conexión directa para migraciones y la segunda puede usar pooling.

Para recuperar un despliegue existente con errores `P2022`, columnas `isCurrent`/`requiresReview` ausentes o la vista `CurrentOrder` faltante: ejecutar `npm run db:deploy` en la Shell del servicio y comprobar `npm run db:status`; después reiniciar. Si la Shell no está disponible, configurar temporalmente Start Command como `npm run db:deploy && npm start` y volver a desplegar. Cuando el servicio usa esta versión, basta con `npm start`. Revisar el error de la migración si el arranque se detiene, antes de intentar otra intervención en la base.
