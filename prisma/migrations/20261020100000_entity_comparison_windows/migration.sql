ALTER TABLE "Municipality"
ADD COLUMN "comparisonMode" TEXT NOT NULL DEFAULT 'MANAGEMENT',
ADD COLUMN "comparisonYears" INTEGER NOT NULL DEFAULT 5;

ALTER TABLE "Municipality"
ADD CONSTRAINT "Municipality_comparisonMode_check"
CHECK ("comparisonMode" IN ('MANAGEMENT', 'ROLLING_YEARS')),
ADD CONSTRAINT "Municipality_comparisonYears_check"
CHECK ("comparisonYears" BETWEEN 1 AND 10);
