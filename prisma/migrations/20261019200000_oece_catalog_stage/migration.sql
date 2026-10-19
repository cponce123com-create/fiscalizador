CREATE TABLE "OeceCatalogEntry" (
    "id" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "province" TEXT,
    "district" TEXT,
    "siafCode" TEXT,
    "officialCode" TEXT NOT NULL,
    "status" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OeceCatalogEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OeceCatalogEntry_ruc_key" ON "OeceCatalogEntry"("ruc");
CREATE UNIQUE INDEX "OeceCatalogEntry_officialCode_key" ON "OeceCatalogEntry"("officialCode");
CREATE INDEX "OeceCatalogEntry_name_idx" ON "OeceCatalogEntry"("name");
CREATE INDEX "OeceCatalogEntry_department_province_district_idx" ON "OeceCatalogEntry"("department", "province", "district");
CREATE INDEX "OeceCatalogEntry_status_idx" ON "OeceCatalogEntry"("status");
CREATE INDEX "OeceCatalogEntry_lastSeenAt_idx" ON "OeceCatalogEntry"("lastSeenAt");
