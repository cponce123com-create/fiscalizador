# Optimización gratuita: búsqueda, pruebas y medición

## Alcance

Esta fase mantiene Render Free, Neon Free, Cloudinary Free y Prisma. No incorpora
servicios alojados ni suscripciones. Tampoco ejecuta pruebas de carga sobre
producción.

## Estado de las ocho herramientas evaluadas

| Herramienta | Estado anterior | Decisión y cambio |
| --- | --- | --- |
| PostgreSQL `pg_trgm` | Ya habilitado con índices GIN | Se conserva como respaldo de coincidencia parcial. No se duplican índices. |
| PostgreSQL Full Text Search | No existía | Se añade un índice GIN de expresión y búsqueda híbrida para órdenes. |
| Prisma | Singleton, pool `max: 5`, consultas parametrizadas | La búsqueda relevante pasa de hasta cinco conteos más lecturas a un conteo y una página. |
| TanStack Query | No instalado; la búsqueda ya cancela peticiones con `AbortController` | No se instala: duplicaría cachés de Next.js y aumentaría JavaScript móvil. |
| Playwright | Solo usado por herramientas Python de descarga | Se agrega Playwright web con pruebas públicas y resoluciones 360, 390, 768 y escritorio. |
| Lighthouse CI | No configurado | Se agrega configuración reproducible; se ejecuta como herramienta efímera para no mantener dependencias antiguas. |
| k6 | No configurado | Se agregan escenarios local `smoke` y de carga expresamente bloqueada para producción. |
| Apache ECharts | Recharts ya cubre los gráficos | No se instala. Mantener una sola librería reduce bundle y mantenimiento. |

## Búsqueda híbrida

La migración `20261016123000_order_full_text_search` crea el índice:

```sql
CREATE INDEX "idx_order_description_search_fts"
ON "Order" USING GIN (
  to_tsvector('simple', coalesce("descriptionSearch", ''))
);
```

Se utiliza `simple` porque los documentos contienen marcas, códigos, siglas y
modelos que no deben derivarse como palabras del español. La prioridad es:

1. número de orden, SIAF o RUC exacto;
2. nombre exacto del proveedor;
3. todas las palabras en el nombre del proveedor, sin importar el orden;
4. coincidencia Full Text Search en la descripción;
5. coincidencia parcial respaldada por `pg_trgm`.

Todos los valores se interpolan mediante `Prisma.sql`; no se concatena entrada del
usuario en SQL.

### Medición pendiente y segura

La comparación de `EXPLAIN (ANALYZE, BUFFERS)` debe hacerse en una rama o copia de
Neon con volumen representativo. No se ejecuta automáticamente contra producción.
Consultas sugeridas: `ipad`, `publicidad institucional`, `spots radiales`,
`mantenimiento de maquinaria` y un RUC exacto.

## Playwright

Instalar Chromium una vez:

```bash
npm run test:e2e:install
```

Ejecutar contra el servidor local:

```bash
npm run test:e2e
```

Para una base E2E conocida:

```bash
E2E_SUPPLIER_SLUG=proveedor-de-prueba \
E2E_MUNICIPALITY_SLUG=oxapampa \
npm run test:e2e
```

`E2E_BASE_URL` permite apuntar a un entorno de pruebas ya desplegado. Las pruebas
incluidas son de lectura; no importan ni eliminan información.

## Lighthouse

Después de `npm run build`:

```bash
npm run lighthouse
```

La herramienta se descarga de forma efímera y fijada en `0.15.1`; así no queda en
las dependencias del proyecto. Los reportes se escriben en `lighthouse-report/` y
no se suben a terceros. Las metas iniciales son advertencias, excepto accesibilidad
menor a 90. Los arranques en frío de Render/Neon deben reportarse por separado.

## k6

Prueba mínima local:

```bash
BASE_URL=http://127.0.0.1:3000 npm run perf:smoke
```

Carga autorizada en un entorno aislado:

```bash
K6_ALLOW_LOAD=1 \
BASE_URL=https://entorno-de-pruebas.example \
TARGET_VUS=5 \
npm run perf:load
```

El script rechaza expresamente `fiscalizador.onrender.com`. k6 se instala en el
equipo o se ejecuta con su imagen oficial; no es dependencia del runtime.

## Coste y compatibilidad

- Coste adicional obligatorio: **S/ 0**.
- La migración solo añade un índice; no modifica ni borra filas.
- El índice consume almacenamiento de Neon y añade un costo pequeño a cada
  importación, por lo que debe medirse antes de añadir otros índices.
- Playwright es dependencia de desarrollo y sus navegadores no se instalan en el
  despliegue de Render.
- No se añadió Redis, TanStack Query ni una segunda librería de gráficos.

