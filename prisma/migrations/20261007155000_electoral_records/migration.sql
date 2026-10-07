ALTER TABLE "SupplierProfile" ADD COLUMN "publicNotes" TEXT, ADD COLUMN "publicSourceUrl" TEXT;
ALTER TABLE "SupplierProfileContact" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "publicNote" TEXT;
CREATE TABLE "ElectoralPerson" (
 "id" TEXT NOT NULL PRIMARY KEY, "fullName" TEXT NOT NULL, "dni" TEXT, "isPublic" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ElectoralPerson_dni_key" ON "ElectoralPerson"("dni");
CREATE INDEX "ElectoralPerson_fullName_idx" ON "ElectoralPerson"("fullName");
CREATE INDEX "ElectoralPerson_isPublic_idx" ON "ElectoralPerson"("isPublic");
CREATE TABLE "ElectoralRecord" (
 "id" TEXT NOT NULL PRIMARY KEY, "personId" TEXT NOT NULL, "electionYear" INTEGER NOT NULL,
 "position" TEXT NOT NULL, "organization" TEXT NOT NULL, "mayorCandidate" TEXT NOT NULL, "municipality" TEXT NOT NULL,
 "termStart" INTEGER NOT NULL, "termEnd" INTEGER NOT NULL, "result" TEXT NOT NULL,
 "source" TEXT NOT NULL, "sourceUrl" TEXT NOT NULL, "isPublic" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ElectoralRecord_personId_fkey" FOREIGN KEY ("personId") REFERENCES "ElectoralPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ElectoralRecord_personId_electionYear_position_municipality_key" ON "ElectoralRecord"("personId", "electionYear", "position", "municipality");
CREATE INDEX "ElectoralRecord_electionYear_idx" ON "ElectoralRecord"("electionYear");
CREATE INDEX "ElectoralRecord_isPublic_idx" ON "ElectoralRecord"("isPublic");
