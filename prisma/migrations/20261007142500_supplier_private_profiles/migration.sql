CREATE TABLE "SupplierProfile" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "birthplace" TEXT,
  "currentAddress" TEXT,
  "notes" TEXT,
  "photoKey" TEXT,
  "photoMime" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierProfile_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SupplierProfileContact" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "dni" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "relationship" TEXT NOT NULL,
  "source" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierProfileContact_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SupplierProfile_supplierId_key" ON "SupplierProfile"("supplierId");
CREATE UNIQUE INDEX "SupplierProfileContact_profileId_dni_key" ON "SupplierProfileContact"("profileId", "dni");
ALTER TABLE "SupplierProfile" ADD CONSTRAINT "SupplierProfile_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierProfileContact" ADD CONSTRAINT "SupplierProfileContact_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SupplierProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
