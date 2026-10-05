# API

Contrato de los endpoints HTTP. Todas las respuestas son JSON.

## Convenciones

- **Autenticación:** cookie de sesión (`httpOnly`). Las rutas bajo `/api/admin`
  exigen sesión y permiso; las de `/api/orders` exigen `orders:read`.
- **Errores:** siempre con la forma `{ "error": "mensaje" }`. El mensaje está
  escrito para el usuario y nunca incluye detalles internos.

| Código | Cuándo |
|---|---|
| `400` | Cuerpo o parámetros mal formados |
| `401` | Sin sesión, o cuenta desactivada |
| `403` | Sesión válida pero el rol no alcanza |
| `404` | El recurso no existe |
| `409` | Conflicto de negocio (p. ej. el periodo ya fue importado) |
| `500` | Error inesperado. El detalle queda en el registro del servidor |

---

## Autenticación

Gestionados por Auth.js. No se documentan en detalle porque su contrato es el de la
librería.

| Ruta | Método | Descripción |
|---|---|---|
| `/api/auth/csrf` | GET | Devuelve el token CSRF necesario para las demás |
| `/api/auth/callback/credentials` | POST | Inicia sesión (form-urlencoded: `csrfToken`, `email`, `password`, `callbackUrl`) |
| `/api/auth/signout` | POST | Cierra la sesión |
| `/api/auth/session` | GET | Devuelve la sesión, o `null` si no hay |

---

## Importador

### `POST /api/admin/imports/analyze`

**Permiso:** `imports:write`
**Cuerpo:** `multipart/form-data`

| Campo | Tipo | Descripción |
|---|---|---|
| `archivo` | File | `.xls`, `.xlsx` o `.csv`. Máximo 25 MB |
| `year` | number | Año del periodo (2000-2100) |
| `month` | number | Mes del periodo (1-12) |
| `importType` | string | `ORDENES_COMPRA`, `ORDENES_SERVICIO` o `CONSOLIDADO` |

**No escribe ninguna orden.** Guarda el archivo original y crea un `ImportBatch` en
estado `VALIDATING`.

Respuesta `201`:

```jsonc
{
  "importBatchId": "cmuv…",
  "checksum": "9f2c…",              // SHA-256 del archivo
  "sheetName": "Sheet0",
  "sheetNames": ["Sheet0"],
  "headerRowIndex": 0,
  "version": 1,
  "columns": [
    {
      "position": 9,
      "originalName": "Monto",
      "field": "amount",            // null si no se reconoció
      "confidence": 1,
      "matchedBy": "EXACTO",        // EXACTO | ALIAS | SIMILITUD | null
      "dataType": "DECIMAL",
      "isRequired": true,
      "isPublic": true,
      "sampleValues": ["S/. 650", "S/. 8546"]
    }
  ],
  "camposFaltantes": [],            // campos obligatorios sin columna asignada
  "preview": [ /* primeras 10 filas con sus hallazgos */ ],
  "summary": {
    "totalRows": 103,
    "successfulRows": 103,
    "warningRows": 1,
    "errorRows": 0,
    "cancelledRows": 1,
    "registeredCents": 106613659,   // enteros, en centavos
    "cancelledCents": 3899487,
    "consideredCents": 102714172
  },
  "issues": [
    {
      "severity": "WARNING",        // ERROR | WARNING | INFO
      "code": "DUPLICADO_EN_LOTE",
      "message": "Registro repetido: ya aparece en la fila 30 del mismo archivo.",
      "sourceRow": 104,
      "columnName": null,
      "rawValue": null
    }
  ],
  "lotesMismoPeriodo": [ /* importaciones previas del mismo periodo */ ],
  "loteMismoChecksum": null       // o el lote con contenido idéntico
}
```

> Los montos se devuelven **en centavos enteros** a propósito: son la misma
> aritmética exacta que se usa para validar, y evitan el error de coma flotante al
> transportarlos.

### `POST /api/admin/imports/confirm`

**Permiso:** `imports:write`
**Cuerpo:** `application/json`

| Campo | Tipo | Descripción |
|---|---|---|
| `importBatchId` | string | Obligatorio. El lote devuelto por `analyze` |
| `mapping` | array | Opcional. Correcciones de mapeo: `{ position, field, isPublic }` |
| `reemplazarPeriodo` | boolean | Obligatorio para importar una versión nueva de un periodo ya cargado |

**No acepta filas.** Relee el archivo guardado en el servidor y escribe todo en una
única transacción.

Respuesta `200`:

```jsonc
{
  "importBatchId": "cmuv…",
  "status": "COMPLETED_WITH_WARNINGS",
  "ordenesInsertadas": 103,
  "proveedoresCreados": 72,
  "proveedoresExistentes": 0,
  "variantesDetectadas": 0,
  "summary": { /* igual que en analyze */ }
}
```

Respuesta `409` si el periodo ya tiene importaciones completadas y no se pasó
`reemplazarPeriodo`. El mensaje indica cuántas hay.

### `GET /api/admin/imports`

**Permiso:** `imports:read`

Listado paginado de importaciones. Parámetro `page` (20 por página).

---

## Órdenes

### `GET /api/orders`

**Permiso:** `orders:read`

| Parámetro | Por defecto | Descripción |
|---|---|---|
| `page` | `1` | Página |
| `pageSize` | `25` | Tamaño de página (máximo 100) |
| `q` | — | Busca en número de orden, RUC y razón social |
| `statusId` | — | Filtra por estado |
| `managementPeriodId` | — | Filtra por gestión |
| `soloAnuladas` | — | `true` para ver solo las anuladas |
| `orderBy` | `issueDate` | `issueDate`, `amount` o `orderNumber` |
| `dir` | `desc` | `asc` o `desc` |

La paginación, el ordenamiento y la suma se resuelven **en PostgreSQL**. El cliente
recibe solo la página solicitada.

Respuesta `200`:

```jsonc
{
  "ordenes": [
    {
      "id": "cmuv…",
      "orderNumber": "217",
      "description": "ADQUISICION DE MATERIALES…",
      "issueDate": "2023-06-06T00:00:00.000Z",
      "commitmentDate": "2023-06-06T00:00:00.000Z",
      "amount": "650.00",              // cadena: es un Decimal
      "isCancelled": false,
      "ruc": "20541487710",
      "siafNumber": "1740",
      "sourceRow": 2,
      "orderType": { "code": "O/C", "label": "Orden de Compra" },
      "status": { "code": "DEVENGADA", "label": "Devengada" },
      "supplier": { "id": "cmuv…", "name": "…", "slug": "…" },
      "managementPeriod": { "name": "2023-2026" }
    }
  ],
  "total": 103,
  "pagina": 1,
  "tamanoPagina": 25,
  "totalPaginas": 5,
  "sumaRegistrada": "1066136.59"     // suma del filtro actual, en el servidor
}
```

> `amount` viaja como **cadena**, no como número. Es un `Decimal` en la base de datos
> y convertirlo a `number` en el transporte perdería exactitud. El formateo para
> mostrar se hace con `Intl.NumberFormat`.

---

## Páginas del panel

| Ruta | Permiso | Descripción |
|---|---|---|
| `/admin/login` | — | Formulario de acceso |
| `/admin` | sesión | Resumen con cifras |
| `/admin/importar` | `imports:write` | Asistente de importación |
| `/admin/importaciones` | `imports:read` | Historial de lotes |
| `/admin/ordenes` | `orders:read` | Tabla de órdenes con filtros |
