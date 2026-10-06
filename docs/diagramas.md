# Diagramas

Diagramas del sistema en Mermaid. Se ven directamente en GitHub y en cualquier editor
que lo soporte.

## Flujo del importador

Dos fases separadas a propósito: en el análisis **no se escribe ninguna orden**, y la
confirmación es una transición atómica seguida de una única transacción.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Administrador
    participant Panel as Panel (/admin/importar)
    participant API as API (/api/admin/imports/*)
    participant Svc as importService
    participant Store as Almacenamiento
    participant DB as PostgreSQL

    Admin->>Panel: Sube el libro (año, mes, tipo)
    Panel->>API: POST /analyze (multipart)
    API->>Svc: analizar()
    Svc->>Svc: parse + mapeo + validación
    Svc->>Store: guarda el archivo original (clave derivada del checksum)
    Svc->>DB: crea ImportBatch en VALIDATING con la versión libre
    Svc-->>API: vista previa, hallazgos y duplicados
    API-->>Panel: 201
    Panel-->>Admin: revisa y decide (mapeo, filas excluidas)

    Admin->>Panel: Confirma la importación
    Panel->>API: POST /confirm (JSON)
    API->>Svc: confirmar()
    Svc->>DB: reclamarLote() — updateMany condicionado al estado
    alt el lote ya se está procesando
        Svc-->>API: ErrorDeNegocio (409)
    else el proceso anterior quedó colgado (>10 min)
        Svc->>DB: auditoría de la recuperación
    end
    Svc->>DB: $transaction — proveedores, órdenes, resúmenes y auditoría
    Svc-->>API: resumen de la importación
    API-->>Panel: 200
```

Puntos que el diagrama deja ver:

- El archivo original se guarda **antes** de cualquier decisión, y su clave se deriva del
  checksum, no del nombre que envía el navegador.
- La confirmación **no recibe filas**: relee el archivo del servidor. Si el navegador
  pudiera enviar las filas ya normalizadas, podría insertar registros que no existen.
- La transición a `PROCESSING` es atómica: si dos peticiones se cruzan, solo una pasa.

## Modelo de datos

Resumen de las relaciones principales (no exhaustivo: omite `Account`, `Session`,
`VerificationToken`, `ColumnVisibility` y `AppSetting`, que no tienen aristas).

```mermaid
erDiagram
    User ||--o{ AuditLog : "deja rastro"
    User ||--o{ ImportBatch : "sube"
    User ||--o{ Account : "credenciales"

    ManagementPeriod ||--o{ ImportBatch : "periodo"
    ManagementPeriod ||--o{ Order : "gestion"
    ManagementPeriod ||--o{ SupplierManagementSummary : "gestion"

    ImportBatch ||--o{ ImportColumn : "columnas detectadas"
    ImportBatch ||--o{ ImportIssue : "hallazgos"
    ImportBatch ||--o{ Order : "inserta"

    Supplier ||--o{ Order : "recibe"
    Supplier ||--o{ SupplierAlias : "variantes de razón social"
    Supplier ||--o{ SupplierPhoto : "fotografías"
    Supplier ||--o{ SupplierManagementSummary : "resumen por gestión"
    Supplier ||--o{ PersonSupplierLink : "vinculado"

    OrderStatus ||--o{ Order : "estado"
    OrderType ||--o{ Order : "tipo de orden"
    ContractType ||--o{ Order : "tipo de contratación"

    Person ||--o{ PersonSupplierLink : "vinculada"
    Person ||--o{ PersonTagOnPerson : "etiquetada"
    PersonTag ||--o{ PersonTagOnPerson : "etiqueta"

    LoginAttempt {
        string scope "EMAIL o IP"
        string key
        int count
        datetime blockedUntil
    }
```

Notas de lectura del modelo:

- `SupplierManagementSummary` es un **agregado materializado** por (proveedor, gestión):
  se rehace al importar y al eliminar, para que el portal no sume en cada visita.
- `Order.dedupeKey` (`orderNumber|ruc|amount|issueDate`) es lo que permite detectar una
  reimportación sin recorrer toda la tabla.
- `Order.amount` es *nullable* a propósito: un monto ilegible se guarda como texto en
  `rawAmount` y se marca con un `ImportIssue`, en vez de convertirse en 0.
- `Person.dni` es único y **nunca se publica**: la ficha pública muestra el nombre.
- `LoginAttempt` no tiene relaciones: es el limitador de intentos, indexado por
  (scope, key).
