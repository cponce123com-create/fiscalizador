-- Base multi-municipalidad.
-- San Ramón queda como entidad por defecto y todos los datos existentes se
-- asignan a ella para mantener compatibilidad con el portal actual.

CREATE TABLE "Municipality" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "shortName" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "ruc" TEXT NOT NULL,
  "province" TEXT NOT NULL DEFAULT 'Chanchamayo',
  "department" TEXT NOT NULL DEFAULT 'Junín',
  "entityType" TEXT NOT NULL DEFAULT 'DISTRITAL',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "logoUrl" TEXT,
  "coverImageUrl" TEXT,
  "primaryColor" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Municipality_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Municipality" ("id", "name", "shortName", "slug", "ruc", "isDefault", "primaryColor")
VALUES (
  'mun-san-ramon',
  'Municipalidad Distrital de San Ramón',
  'San Ramón',
  'san-ramon',
  '20146657142',
  true,
  '#006b3f'
)
ON CONFLICT ("id") DO NOTHING;

CREATE UNIQUE INDEX "Municipality_slug_key" ON "Municipality"("slug");
CREATE UNIQUE INDEX "Municipality_ruc_key" ON "Municipality"("ruc");
CREATE INDEX "Municipality_isDefault_idx" ON "Municipality"("isDefault");
CREATE INDEX "Municipality_isActive_idx" ON "Municipality"("isActive");
CREATE INDEX "Municipality_province_idx" ON "Municipality"("province");

ALTER TABLE "ImportBatch"
ADD COLUMN "municipalityId" TEXT NOT NULL DEFAULT 'mun-san-ramon';

ALTER TABLE "Order"
ADD COLUMN "municipalityId" TEXT NOT NULL DEFAULT 'mun-san-ramon';

ALTER TABLE "SupplierManagementSummary"
ADD COLUMN "municipalityId" TEXT NOT NULL DEFAULT 'mun-san-ramon';

ALTER TABLE "ImportBatch"
ADD CONSTRAINT "ImportBatch_municipalityId_fkey"
FOREIGN KEY ("municipalityId") REFERENCES "Municipality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order"
ADD CONSTRAINT "Order_municipalityId_fkey"
FOREIGN KEY ("municipalityId") REFERENCES "Municipality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierManagementSummary"
ADD CONSTRAINT "SupplierManagementSummary_municipalityId_fkey"
FOREIGN KEY ("municipalityId") REFERENCES "Municipality"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "ImportBatch_year_month_importType_version_key";
CREATE UNIQUE INDEX "ImportBatch_municipalityId_year_month_importType_version_key"
ON "ImportBatch"("municipalityId", "year", "month", "importType", "version");

DROP INDEX IF EXISTS "SupplierManagementSummary_supplierId_managementPeriodId_key";
CREATE UNIQUE INDEX "SupplierManagementSummary_supplierId_municipalityId_managementPeriodId_key"
ON "SupplierManagementSummary"("supplierId", "municipalityId", "managementPeriodId");

DROP INDEX IF EXISTS "ImportBatch_one_current_book";
CREATE UNIQUE INDEX "ImportBatch_one_current_book"
ON "ImportBatch"("municipalityId", "year", "month", "importType")
WHERE "isCurrent" = true;

CREATE INDEX "ImportBatch_municipalityId_idx" ON "ImportBatch"("municipalityId");
CREATE INDEX "Order_municipalityId_idx" ON "Order"("municipalityId");
CREATE INDEX "SupplierManagementSummary_municipalityId_idx" ON "SupplierManagementSummary"("municipalityId");

DROP VIEW IF EXISTS "CurrentOrder";
CREATE VIEW "CurrentOrder" AS
SELECT o.*
FROM "Order" o
JOIN "ImportBatch" b ON b.id = o."importBatchId"
WHERE b."isCurrent" = true
  AND b.status IN ('COMPLETED', 'COMPLETED_WITH_WARNINGS');
