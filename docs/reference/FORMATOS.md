# Formatos reales del libro fuente

Documento derivado de la inspección del archivo de referencia durante el **Paso 0**
del plan de implementación. **No contiene supuestos**: todo lo que aparece aquí se
comprobó abriendo `docs/reference/Lista-OCOS-2023-06.xls` con SheetJS.

Archivo original: `Lista-OCOS (5).xls`, descargado del Portal de Transparencia.

---

## Estructura

| Propiedad | Valor |
|---|---|
| Hojas | 1 (`Sheet0`) |
| Rango | `A1:L104` |
| Filas de encabezado | 1 (la primera) |
| Filas de datos | 103 |
| Filas vacías | 0 |
| Celdas combinadas | 0 |
| Filas de título o logos | ninguna |
| Filas de totales al final | ninguna |
| Fila anómala | 1 (fila 30 del archivo, incompleta — ver más abajo) |

**Las 12 columnas llegan como texto** (tipo de celda `s`). No hay ninguna celda
numérica ni de fecha nativa, así que no hay seriales de Excel que interpretar.

## Columnas, en orden

```
N° | Tipo de Orden | Número de orden | Tipo de Contratación |
Descripción y Finalidad de la contratación | Nro. Exp. SIAF |
Fecha de Emisión | Fecha de Compromiso | Estado | Monto | RUC |
Denominación o razón Social
```

## Formatos observados

| Campo | Formato real | Nota |
|---|---|---|
| `Fecha de Emisión` | `2023-06-06 00:00:00.0` | ISO con hora, **como texto**. No es `dd/mm/yyyy`. |
| `Fecha de Compromiso` | `2023-06-06 00:00:00.0` | Igual. Hora siempre `00:00:00.0`. |
| `Monto` | `S/. 650`, `S/. 14769.5` | Prefijo **`S/.`** (con punto). Punto decimal. Sin comas de miles. |
| `RUC` | `20541487710` | 11 dígitos, texto. Presente en las 103 filas. |
| `Número de orden` | `217` | Texto. |
| `Nro. Exp. SIAF` | `1740` | Texto. |

Decimales del monto: 0 decimales en 88 filas, 1 decimal en 9, 2 decimales en 6.

## Valores distintos

### Estado (2 valores)

| Valor | Filas |
|---|---|
| `Devengada` | 102 |
| `Anulada` | 1 |

### Tipo de Orden (2 valores)

| Valor | Filas |
|---|---|
| `O/S` | 63 |
| `O/C` | 40 |

### Tipo de Contratación (2 valores)

| Valor | Filas |
|---|---|
| `Contrataciones hasta 8 UIT (LEY 30225)((No incluye las derivadas de contrataciones por catálogo electrónico.)` | 98 |
| `Deviene de Procesos de Selección` | 5 |

El doble paréntesis `((` es un defecto del archivo de origen. Se conserva.

## Cifras de control

Estas cifras están ancladas en pruebas automatizadas
(`services/parseService.test.ts` y `services/validationService.test.ts`).
Si el importador deja de reproducirlas, una prueba falla.

| Métrica | Valor |
|---|---|
| Monto registrado | `S/ 1.066.136,59` |
| Monto anulado | `S/ 38.994,87` |
| **Monto considerado** | **`S/ 1.027.141,72`** |
| Órdenes | 103 |
| Proveedores distintos | 72 |
| RUC 10 (persona natural) | 66 filas |
| RUC 20 (persona jurídica) | 37 filas |

Las sumas se comprueban **en centavos enteros**, no en coma flotante: es la misma
razón por la que la columna `Order.amount` es `Decimal(14,2)` y no `Float`.

## Calidad de los datos de origen

### La fila anulada

Fila 30 del archivo (orden `245`), la única con `Estado = Anulada`:

- Proveedor: `INVERSIONES URRUCHI S.A.C.` (RUC `20610345990`)
- Monto: `S/. 38994.87`
- `Nro. Exp. SIAF`: **vacío**
- `Fecha de Compromiso`: **vacío**

Es el caso de prueba real del requisito "una orden anulada no debe sumarse al
monto considerado": la orden **existe** y **se muestra**, pero no suma.

### Números de orden duplicados

Aparecen dos números de orden repetidos: **`238`** y **`245`** (2 veces cada uno).
Hay 101 números distintos en 103 filas.

La detección de duplicados no es un requisito hipotético: este archivo la necesita.

### `Nro. Exp. SIAF` no es un identificador

99 valores distintos con 4 repetidos (`1578`, `1677`, `1678`, `1700`). Además, en
una fila coincide con el número de orden. **No puede usarse como clave única.**

### Caracteres defectuosos de origen

18 descripciones contienen `¿` (U+00BF) donde el origen debía tener un guion. Por
ejemplo:

```
ADQUISICION DE MATERIALES DE FERRETERIA PARA EL PROYECTO  ¿MEJORAMIENTO DEL
SERVICIO DE EDUCACION BASICA ESPECIAL ... DISTRITO DE SAN RAMON ¿ PROVINCIA DE
CHANCHAMAYO ¿ DEPARTAMENTO JUNÍN¿.
```

**Se conservan tal cual.** Corregirlos en silencio sería falsear el dato de origen
(sección 44 del pliego). El archivo original se guarda íntegro y `rawData` mantiene
el texto sin tocar.

### Sin variaciones de razón social en este archivo

Ningún RUC aparece con dos denominaciones distintas. La detección de variaciones
(sección 10 del pliego) se cubre con pruebas sintéticas, no con este libro.

## Relevancia para la elección de librería

El archivo es **`.xls` legacy (BIFF8)**. **ExcelJS no puede leerlo**: solo soporta
`.xlsx` y `.csv`. Por eso el parser es **SheetJS (`xlsx`)**, que además lee `.xlsx`
y `.csv` por la misma vía y evita una etapa de conversión.

Se usa la versión oficial `0.20.3` del CDN de SheetJS, no la `0.18.5` publicada en
npm, que arrastra vulnerabilidades conocidas (prototype pollution y ReDoS) en una
ruta que aquí procesa **archivos subidos por usuarios**.
