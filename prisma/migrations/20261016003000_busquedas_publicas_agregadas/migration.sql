CREATE TABLE "PublicSearchTerm" (
    "id" TEXT NOT NULL,
    "normalizedTerm" TEXT NOT NULL,
    "displayTerm" TEXT NOT NULL,
    "uses" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublicSearchTerm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PublicSearchTerm_normalizedTerm_key" ON "PublicSearchTerm"("normalizedTerm");
CREATE INDEX "PublicSearchTerm_uses_lastUsedAt_idx" ON "PublicSearchTerm"("uses", "lastUsedAt");
