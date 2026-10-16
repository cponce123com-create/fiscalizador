-- Búsqueda de texto completo para las descripciones normalizadas de órdenes.
--
-- Se usa la configuración `simple` deliberadamente: los libros contienen marcas,
-- siglas, modelos y códigos (IPAD, OC, SIAF, 4X4) que un diccionario lingüístico
-- en español podría transformar o descartar. La búsqueda aproximada de nombres se
-- mantiene en pg_trgm; este índice se concentra en conceptos y objetos de gasto.
CREATE INDEX IF NOT EXISTS "idx_order_description_search_fts"
ON "Order" USING GIN (
  to_tsvector('simple', coalesce("descriptionSearch", ''))
);

