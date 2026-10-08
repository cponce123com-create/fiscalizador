# Índices de búsqueda

La búsqueda pública y administrativa usa columnas normalizadas como
`Order.descriptionSearch`, `Supplier.normalizedName` y `Supplier.name`.

La migración `20261008215500_add_trigram_search_indexes` habilita `pg_trgm` y
crea índices GIN sobre esas columnas. Esto acelera búsquedas con `contains` y
deja preparada la base para coincidencias parciales y fuzzy sin cambiar el modelo
de Prisma.

## Comprobación manual

En una copia de la base con datos reales:

```sql
EXPLAIN ANALYZE
SELECT id
FROM "Order"
WHERE "descriptionSearch" ILIKE '% ipad %'
LIMIT 20;
```

El plan debe preferir el índice trigram cuando la tabla ya tenga suficiente
volumen. En tablas pequeñas PostgreSQL puede elegir un recorrido secuencial,
lo cual es normal.
