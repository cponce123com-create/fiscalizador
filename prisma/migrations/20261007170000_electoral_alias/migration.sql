CREATE TABLE "ElectoralPersonAlias" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "personId" TEXT NOT NULL REFERENCES "ElectoralPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ElectoralPersonAlias_personId_idx" ON "ElectoralPersonAlias"("personId");
