-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "SupplierType" AS ENUM ('PERSONA_NATURAL', 'PERSONA_JURIDICA', 'OTRO', 'DESCONOCIDO');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADED', 'VALIDATING', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('ORDENES_COMPRA', 'ORDENES_SERVICIO', 'CONSOLIDADO');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('ERROR', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "ColumnDataType" AS ENUM ('STRING', 'INTEGER', 'DECIMAL', 'DATE', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "AliasSource" AS ENUM ('IMPORT', 'MANUAL');

-- CreateEnum
CREATE TYPE "AliasDecision" AS ENUM ('PENDING', 'MERGED', 'KEPT_SEPARATE', 'IGNORED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'IMPORT', 'MERGE_SUPPLIER', 'CHANGE_PHOTO', 'CHANGE_COLUMN_VISIBILITY', 'CHANGE_SETTINGS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "ManagementPeriod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagementPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatus" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "countsEconomically" BOOLEAN NOT NULL DEFAULT true,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "isUnknown" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColumnVisibility" (
    "id" TEXT NOT NULL,
    "internalField" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColumnVisibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "importType" "ImportType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "checksum" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successfulRows" INTEGER NOT NULL DEFAULT 0,
    "warningRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "originalFileUrl" TEXT,
    "storageKey" TEXT,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingStartedAt" TIMESTAMP(3),
    "processingFinishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "managementPeriodId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportColumn" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "internalField" TEXT,
    "dataType" "ColumnDataType" NOT NULL DEFAULT 'STRING',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "confidence" DOUBLE PRECISION,
    "sampleValues" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportIssue" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "severity" "IssueSeverity" NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sourceRow" INTEGER,
    "columnName" TEXT,
    "rawValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "supplierType" "SupplierType" NOT NULL DEFAULT 'DESCONOCIDO',
    "rucPrefix" TEXT,
    "photoUrl" TEXT,
    "cloudinaryPublicId" TEXT,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierAlias" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "source" "AliasSource" NOT NULL DEFAULT 'IMPORT',
    "decision" "AliasDecision" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPhoto" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "cloudinaryPublicId" TEXT NOT NULL,
    "secureUrl" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "rowNumber" INTEGER,
    "sourceRow" INTEGER,
    "orderNumber" TEXT NOT NULL,
    "orderTypeId" TEXT,
    "contractTypeId" TEXT,
    "description" TEXT,
    "siafNumber" TEXT,
    "issueDate" DATE,
    "commitmentDate" DATE,
    "statusId" TEXT,
    "rawStatus" TEXT,
    "amount" DECIMAL(14,2),
    "rawAmount" TEXT,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "ruc" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "managementPeriodId" TEXT,
    "rawData" JSONB NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierManagementSummary" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "managementPeriodId" TEXT NOT NULL,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "cancelledCount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cancelledAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "consideredAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "firstIssueDate" DATE,
    "lastIssueDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierManagementSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expires_idx" ON "Session"("expires");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "ManagementPeriod_name_key" ON "ManagementPeriod"("name");

-- CreateIndex
CREATE INDEX "ManagementPeriod_startDate_idx" ON "ManagementPeriod"("startDate");

-- CreateIndex
CREATE INDEX "ManagementPeriod_endDate_idx" ON "ManagementPeriod"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "OrderStatus_code_key" ON "OrderStatus"("code");

-- CreateIndex
CREATE INDEX "OrderStatus_isCancelled_idx" ON "OrderStatus"("isCancelled");

-- CreateIndex
CREATE INDEX "OrderStatus_countsEconomically_idx" ON "OrderStatus"("countsEconomically");

-- CreateIndex
CREATE UNIQUE INDEX "OrderType_code_key" ON "OrderType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ContractType_code_key" ON "ContractType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ColumnVisibility_internalField_key" ON "ColumnVisibility"("internalField");

-- CreateIndex
CREATE INDEX "ImportBatch_period_idx" ON "ImportBatch"("period");

-- CreateIndex
CREATE INDEX "ImportBatch_status_idx" ON "ImportBatch"("status");

-- CreateIndex
CREATE INDEX "ImportBatch_checksum_idx" ON "ImportBatch"("checksum");

-- CreateIndex
CREATE INDEX "ImportBatch_uploadedById_idx" ON "ImportBatch"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_year_month_importType_version_key" ON "ImportBatch"("year", "month", "importType", "version");

-- CreateIndex
CREATE INDEX "ImportColumn_importBatchId_idx" ON "ImportColumn"("importBatchId");

-- CreateIndex
CREATE INDEX "ImportColumn_internalField_idx" ON "ImportColumn"("internalField");

-- CreateIndex
CREATE UNIQUE INDEX "ImportColumn_importBatchId_originalName_key" ON "ImportColumn"("importBatchId", "originalName");

-- CreateIndex
CREATE INDEX "ImportIssue_importBatchId_severity_idx" ON "ImportIssue"("importBatchId", "severity");

-- CreateIndex
CREATE INDEX "ImportIssue_code_idx" ON "ImportIssue"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_ruc_key" ON "Supplier"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_slug_key" ON "Supplier"("slug");

-- CreateIndex
CREATE INDEX "Supplier_ruc_idx" ON "Supplier"("ruc");

-- CreateIndex
CREATE INDEX "Supplier_normalizedName_idx" ON "Supplier"("normalizedName");

-- CreateIndex
CREATE INDEX "Supplier_supplierType_idx" ON "Supplier"("supplierType");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "SupplierAlias_normalizedName_idx" ON "SupplierAlias"("normalizedName");

-- CreateIndex
CREATE INDEX "SupplierAlias_decision_idx" ON "SupplierAlias"("decision");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierAlias_supplierId_normalizedName_key" ON "SupplierAlias"("supplierId", "normalizedName");

-- CreateIndex
CREATE INDEX "SupplierPhoto_supplierId_idx" ON "SupplierPhoto"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierPhoto_isPrimary_idx" ON "SupplierPhoto"("isPrimary");

-- CreateIndex
CREATE INDEX "Order_ruc_idx" ON "Order"("ruc");

-- CreateIndex
CREATE INDEX "Order_supplierId_idx" ON "Order"("supplierId");

-- CreateIndex
CREATE INDEX "Order_issueDate_idx" ON "Order"("issueDate");

-- CreateIndex
CREATE INDEX "Order_statusId_idx" ON "Order"("statusId");

-- CreateIndex
CREATE INDEX "Order_importBatchId_idx" ON "Order"("importBatchId");

-- CreateIndex
CREATE INDEX "Order_managementPeriodId_idx" ON "Order"("managementPeriodId");

-- CreateIndex
CREATE INDEX "Order_dedupeKey_idx" ON "Order"("dedupeKey");

-- CreateIndex
CREATE INDEX "Order_statusId_issueDate_idx" ON "Order"("statusId", "issueDate");

-- CreateIndex
CREATE INDEX "Order_supplierId_issueDate_idx" ON "Order"("supplierId", "issueDate");

-- CreateIndex
CREATE INDEX "Order_orderNumber_idx" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "SupplierManagementSummary_managementPeriodId_idx" ON "SupplierManagementSummary"("managementPeriodId");

-- CreateIndex
CREATE INDEX "SupplierManagementSummary_consideredAmount_idx" ON "SupplierManagementSummary"("consideredAmount");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierManagementSummary_supplierId_managementPeriodId_key" ON "SupplierManagementSummary"("supplierId", "managementPeriodId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_managementPeriodId_fkey" FOREIGN KEY ("managementPeriodId") REFERENCES "ManagementPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportColumn" ADD CONSTRAINT "ImportColumn_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportIssue" ADD CONSTRAINT "ImportIssue_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAlias" ADD CONSTRAINT "SupplierAlias_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPhoto" ADD CONSTRAINT "SupplierPhoto_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_managementPeriodId_fkey" FOREIGN KEY ("managementPeriodId") REFERENCES "ManagementPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_orderTypeId_fkey" FOREIGN KEY ("orderTypeId") REFERENCES "OrderType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_contractTypeId_fkey" FOREIGN KEY ("contractTypeId") REFERENCES "ContractType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "OrderStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierManagementSummary" ADD CONSTRAINT "SupplierManagementSummary_managementPeriodId_fkey" FOREIGN KEY ("managementPeriodId") REFERENCES "ManagementPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierManagementSummary" ADD CONSTRAINT "SupplierManagementSummary_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
