ALTER TABLE "Municipality"
ADD COLUMN "officialCode" TEXT,
ADD COLUMN "catalogUpdatedAt" TIMESTAMP(3),
ADD COLUMN "parentEntityId" TEXT;

CREATE UNIQUE INDEX "Municipality_officialCode_key"
ON "Municipality"("officialCode");

CREATE INDEX "Municipality_catalogUpdatedAt_idx"
ON "Municipality"("catalogUpdatedAt");

CREATE INDEX "Municipality_parentEntityId_idx"
ON "Municipality"("parentEntityId");

ALTER TABLE "Municipality"
ADD CONSTRAINT "Municipality_parentEntityId_fkey"
FOREIGN KEY ("parentEntityId") REFERENCES "Municipality"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
