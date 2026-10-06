# Estructura de los datos extraídos

## 1. Órdenes normalizadas (`ordenes-<marca>.csv` y `.json`)

Una fila por orden de compra o de servicio. Los nueve primeros campos son los que pide el
encargo; el resto está para poder auditar de dónde salió cada cifra.

| Campo | Tipo | Origen | Reglas |
|---|---|---|---|
| `ruc_entidad` | texto (11) | Configuración, o columna del libro | Se valida con el módulo 11. Si no es válido, queda vacío y se anota un aviso |
| `entidad` | texto | Configuración, o columna del libro | |
| `ruc_proveedor` | texto (11) | Columna «RUC Proveedor» / «RUC» | Igual: validado. Un RUC mal tecleado **no** se propaga |
| `proveedor` | texto | «Proveedor» / «Razón Social» | |
| `monto` | decimal como texto | «Monto» / «Importe» / «Valor» | `Decimal`, nunca `float`. Vacío si es ilegible: **nunca 0** |
| `moneda` | texto (ISO) | «Moneda», o el símbolo del propio monto | `PEN` por defecto. `US$` → `USD`, `€` → `EUR` |
| `fecha` | fecha ISO | «Fecha» / «Fecha de Emisión» | `AAAA-MM-DD`. Acepta `dd/mm/aaaa`, ISO y con hora |
| `objeto` | texto | «Objeto» / «Descripción» / «Concepto» | |
| `estado` | texto | «Estado» / «Situación» | |
| `origen` | texto | — | `transparencia` o `seace` |
| `archivo_origen` | texto | — | Nombre del archivo, o `seace:<ruc>:<periodo>` |
| `fila_origen` | entero | — | Número de fila dentro del archivo |
| `anio`, `mes` | entero | — | Periodo consultado |
| `avisos` | texto | — | En el CSV, los avisos van unidos con ` | `. En el JSON son una lista |

### Los avisos son parte del dato

Cuando un campo no se puede leer, **la fila se entrega igual** con el campo vacío y un
aviso. Los avisos posibles son:

* `RUC de proveedor inválido: '...'`
* `Sin RUC de proveedor`
* `RUC de entidad inválido: '...'`
* `Monto ilegible o vacío`
* `Fecha ilegible o vacía`
* `Sin nombre de proveedor`

Descartar esas filas en silencio escondería un problema del dato que alguien tiene que
poder ver. El resumen de la corrida cuenta cuántas órdenes llegaron completas
(`ordenes_completas`), que es la cifra honesta: el total incluye las que tienen avisos.

### Ejemplo

```csv
ruc_entidad,entidad,ruc_proveedor,proveedor,monto,moneda,fecha,objeto,estado,origen,archivo_origen,fila_origen,anio,mes,avisos
20146657142,Municipalidad Distrital de San Ramón,20131312955,PROVEEDOR UNO S.A.C.,1234.56,PEN,2023-06-15,Compra de útiles,Atendida,transparencia,ordenes-2023-06.xls,4,2023,6,
20146657142,Municipalidad Distrital de San Ramón,,PROVEEDOR DOS,,PEN,,Servicio de limpieza,,transparencia,ordenes-2023-06.xls,5,2023,6,RUC de proveedor inválido: '123' | Monto ilegible o vacío
```

## 2. Inventario de libros (`libros-<marca>.json`)

Lo que se descargó, para poder volver al origen de cualquier cifra.

| Campo | Descripción |
|---|---|
| `origen` | `transparencia` (los libros de SEACE no se descargan: se leen en pantalla) |
| `entidad_ruc`, `entidad_nombre` | De quién es el libro |
| `anio`, `mes` | Periodo |
| `nombre_archivo`, `ruta_local` | Dónde quedó |
| `url_origen` | URL exacta de la que se bajó |
| `fecha_descarga` | ISO 8601 |
| `checksum_sha256` | Permite saber si dos descargas son el mismo libro sin comparar bytes |
| `tamano_bytes`, `tipo_mime` | |
| `notas` | Texto del enlace, si lo tenía |

## 3. Resumen de la corrida (`resumen-<marca>.json`)

```json
{
  "iniciado_en": "2026-10-06T09:00:00",
  "terminado_en": "2026-10-06T09:04:12",
  "libros_descargados": 3,
  "ordenes_normalizadas": 412,
  "ordenes_completas": 407,
  "errores": 1,
  "advertencias": 2
}
```

## 4. Correspondencia entre columnas y encabezados

El normalizador **no va por posición**: busca los encabezados por nombre, porque cada
entidad ordena las columnas a su manera. Los alias aceptados están en
`ocos/normalizador.py` (libros) y en `ocos/tablas.py` (tabla de SEACE).

Dos detalles que costaron un bug cada uno y están cubiertos por pruebas:

* Se resuelven primero las coincidencias **exactas** y cada columna se asigna una sola
  vez. Sin eso, el alias «proveedor» encaja dentro de «RUC Proveedor» y el nombre del
  proveedor acaba siendo el RUC.
* La cabecera no tiene por qué estar en la primera fila: los libros empiezan con el
  escudo, el nombre de la entidad y el periodo. Se busca la fila que menciona al menos dos
  columnas conocidas (`lectores.separar_encabezado`).

## 5. Formatos de importe aceptados

| Entrada | Resultado | Por qué |
|---|---|---|
| `1,234.56` | `1234.56` | Formato peruano/anglosajón |
| `1.234,56` | `1234.56` | Formato europeo: el último separador es el decimal |
| `1234.56` | `1234.56` | Sin ambigüedad |
| `1,234` | `1234` | Tres dígitos detrás: separador de millares |
| `12,5` | `12.5` | Un dígito detrás: decimal |
| `(1,234.56)` | `-1234.56` | Negativo entre paréntesis |
| `S/ 1,234.56` | `1234.56` | Se quita el símbolo; la moneda va aparte |
| `N/A`, `-`, vacío | *(nulo)* | **Nunca 0** |
| `1.2.3` | *(nulo)* | No es un número |
