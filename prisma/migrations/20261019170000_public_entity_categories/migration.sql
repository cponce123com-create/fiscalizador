ALTER TABLE "Municipality"
ADD COLUMN "entityCategory" TEXT NOT NULL DEFAULT 'MUNICIPALIDAD';

CREATE INDEX "Municipality_entityCategory_isActive_idx"
ON "Municipality"("entityCategory", "isActive");
