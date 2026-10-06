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

`AUTH_SECRET` firma los JWT de sesión.

> **Consecuencia**: al cambiarlo, **todas las sesiones abiertas dejan de ser válidas** y
> todo el mundo tiene que volver a iniciar sesión. No se pierde ningún dato; solo hay que
> avisar antes de hacerlo.

1. Generar uno nuevo: `openssl rand -base64 32`.
2. **Render** → *Environment* → `AUTH_SECRET` → pegar el valor nuevo → guardar.
3. Render redespliega. Verificar el login.

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
