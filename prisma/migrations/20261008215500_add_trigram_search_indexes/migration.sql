CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "idx_orders_description_search_trgm"
ON "Order" USING GIN ("descriptionSearch" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_suppliers_normalized_name_trgm"
ON "Supplier" USING GIN ("normalizedName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_suppliers_name_trgm"
ON "Supplier" USING GIN ("name" gin_trgm_ops);
