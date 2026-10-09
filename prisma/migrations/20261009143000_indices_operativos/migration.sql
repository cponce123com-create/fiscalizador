-- Índices operativos para búsquedas, rankings y auditoría.
-- No se usa CREATE INDEX CONCURRENTLY porque Prisma Migrate puede envolver la
-- migración en una transacción y PostgreSQL lo rechaza en ese contexto.

CREATE INDEX IF NOT EXISTS "idx_supplier_name_type"
ON "Supplier" ("normalizedName", "supplierType");

CREATE INDEX IF NOT EXISTS "idx_supplier_ruc_prefix"
ON "Supplier" ("rucPrefix", "supplierType");

CREATE INDEX IF NOT EXISTS "idx_order_supplier_date_amount_active"
ON "Order" ("supplierId", "issueDate" DESC, "amount" DESC)
WHERE "isCancelled" = false;

CREATE INDEX IF NOT EXISTS "idx_order_cancelled_supplier_amount"
ON "Order" ("supplierId", "amount")
WHERE "isCancelled" = true;

CREATE INDEX IF NOT EXISTS "idx_order_dedupe_batch"
ON "Order" ("importBatchId", "dedupeKey");

CREATE INDEX IF NOT EXISTS "idx_import_batch_current_period"
ON "ImportBatch" ("isCurrent", "year" DESC, "month" DESC)
WHERE "status" IN ('COMPLETED', 'COMPLETED_WITH_WARNINGS');

CREATE INDEX IF NOT EXISTS "idx_audit_log_recent_action"
ON "AuditLog" ("createdAt" DESC, "action");
