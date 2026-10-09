CREATE TABLE "ComparatorReview" (
  "id" TEXT NOT NULL,
  "subjectKey" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "reviewed" BOOLEAN NOT NULL DEFAULT false,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ComparatorReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ComparatorReview_subjectKey_supplierId_key" ON "ComparatorReview"("subjectKey", "supplierId");
CREATE INDEX "ComparatorReview_reviewed_idx" ON "ComparatorReview"("reviewed");
CREATE INDEX "ComparatorReview_supplierId_idx" ON "ComparatorReview"("supplierId");

ALTER TABLE "ComparatorReview"
  ADD CONSTRAINT "ComparatorReview_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
