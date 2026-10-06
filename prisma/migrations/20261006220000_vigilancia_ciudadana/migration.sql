BEGIN;
ALTER TABLE "ImportBatch" ADD COLUMN "isCurrent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requiresReview" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "coverageComplete" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "sheetName" TEXT,
  ADD COLUMN "excludedRows" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PersonSupplierLink" ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "validFrom" DATE, ADD COLUMN "validUntil" DATE, ADD COLUMN "verifiedAt" TIMESTAMP(3);
-- Los lotes anteriores pueden contener solo filas nuevas por deduplicación.
-- No se puede elegir el último y asumir una instantánea completa.
UPDATE "ImportBatch" b SET "requiresReview" = true
WHERE b.status IN ('COMPLETED', 'COMPLETED_WITH_WARNINGS') AND EXISTS (
 SELECT 1 FROM "ImportBatch" other WHERE other.id <> b.id
 AND other.year = b.year AND other.month = b.month
 AND other.status IN ('COMPLETED', 'COMPLETED_WITH_WARNINGS')
 AND (other."importType" = b."importType" OR other."importType" = 'CONSOLIDADO' OR b."importType" = 'CONSOLIDADO')
);
UPDATE "ImportBatch" SET "isCurrent" = true
WHERE status IN ('COMPLETED', 'COMPLETED_WITH_WARNINGS') AND "requiresReview" = false;
CREATE VIEW "CurrentOrder" AS SELECT o.* FROM "Order" o
JOIN "ImportBatch" b ON b.id = o."importBatchId"
WHERE b."isCurrent" = true AND b.status IN ('COMPLETED', 'COMPLETED_WITH_WARNINGS');
-- Reconstruir resúmenes del universo vigente conservando todos los originales.
UPDATE "SupplierManagementSummary" s SET
 "orderCount" = (SELECT COUNT(*) FROM "CurrentOrder" o WHERE o."supplierId"=s."supplierId" AND o."managementPeriodId"=s."managementPeriodId"),
 "cancelledCount" = (SELECT COUNT(*) FROM "CurrentOrder" o WHERE o."supplierId"=s."supplierId" AND o."managementPeriodId"=s."managementPeriodId" AND o."isCancelled"),
 "totalAmount" = COALESCE((SELECT SUM(o.amount) FROM "CurrentOrder" o WHERE o."supplierId"=s."supplierId" AND o."managementPeriodId"=s."managementPeriodId"),0),
 "cancelledAmount" = COALESCE((SELECT SUM(o.amount) FROM "CurrentOrder" o WHERE o."supplierId"=s."supplierId" AND o."managementPeriodId"=s."managementPeriodId" AND o."isCancelled"),0),
 "consideredAmount" = COALESCE((SELECT SUM(o.amount) FROM "CurrentOrder" o JOIN "OrderStatus" st ON st.id=o."statusId" WHERE o."supplierId"=s."supplierId" AND o."managementPeriodId"=s."managementPeriodId" AND NOT o."isCancelled" AND st."countsEconomically"),0);

UPDATE "SupplierManagementSummary" s SET
 "firstIssueDate" = (SELECT MIN(o."issueDate") FROM "CurrentOrder" o WHERE o."supplierId"=s."supplierId" AND o."managementPeriodId"=s."managementPeriodId"),
 "lastIssueDate" = (SELECT MAX(o."issueDate") FROM "CurrentOrder" o WHERE o."supplierId"=s."supplierId" AND o."managementPeriodId"=s."managementPeriodId");
DELETE FROM "SupplierManagementSummary" WHERE "orderCount"=0;
CREATE INDEX "ImportBatch_isCurrent_year_month_idx" ON "ImportBatch"("isCurrent", year, month);
CREATE UNIQUE INDEX "ImportBatch_one_current_book" ON "ImportBatch"(year, month, "importType") WHERE "isCurrent"=true;
COMMIT;
