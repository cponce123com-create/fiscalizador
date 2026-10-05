-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonTag" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonTagOnPerson" (
    "personId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonTagOnPerson_pkey" PRIMARY KEY ("personId","tagId")
);

-- CreateTable
CREATE TABLE "PersonSupplierLink" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonSupplierLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_dni_key" ON "Person"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Person_slug_key" ON "Person"("slug");

-- CreateIndex
CREATE INDEX "Person_isPublic_idx" ON "Person"("isPublic");

-- CreateIndex
CREATE INDEX "Person_fullName_idx" ON "Person"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "PersonTag_code_key" ON "PersonTag"("code");

-- CreateIndex
CREATE INDEX "PersonTag_position_idx" ON "PersonTag"("position");

-- CreateIndex
CREATE INDEX "PersonTag_isPublic_idx" ON "PersonTag"("isPublic");

-- CreateIndex
CREATE INDEX "PersonTagOnPerson_tagId_idx" ON "PersonTagOnPerson"("tagId");

-- CreateIndex
CREATE INDEX "PersonSupplierLink_personId_idx" ON "PersonSupplierLink"("personId");

-- CreateIndex
CREATE INDEX "PersonSupplierLink_supplierId_idx" ON "PersonSupplierLink"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonSupplierLink_personId_supplierId_key" ON "PersonSupplierLink"("personId", "supplierId");

-- AddForeignKey
ALTER TABLE "PersonTagOnPerson" ADD CONSTRAINT "PersonTagOnPerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonTagOnPerson" ADD CONSTRAINT "PersonTagOnPerson_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "PersonTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonSupplierLink" ADD CONSTRAINT "PersonSupplierLink_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonSupplierLink" ADD CONSTRAINT "PersonSupplierLink_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
