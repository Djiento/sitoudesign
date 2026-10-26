-- CreateEnum
CREATE TYPE "ExpenseFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExpenseCancellationStatus" AS ENUM ('NONE', 'REQUESTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExpensePaymentMethod" AS ENUM ('CASH', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'OTHER');

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "invoiceDate" TIMESTAMP(3),
    "invoiceNumber" TEXT,
    "beneficiary" TEXT NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'UNPAID',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "internalComment" TEXT,
    "details" JSONB,
    "isDeposit" BOOLEAN NOT NULL DEFAULT false,
    "cancellationStatus" "ExpenseCancellationStatus" NOT NULL DEFAULT 'NONE',
    "cancellationReason" TEXT,
    "cancellationRequestedById" TEXT,
    "cancellationApprovedById" TEXT,
    "cancellationRequestedAt" TIMESTAMP(3),
    "cancellationApprovedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "scheduledOccurrenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpensePayment" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "ExpensePaymentMethod" NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "comment" TEXT,
    "isVoided" BOOLEAN NOT NULL DEFAULT false,
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "voidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpensePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseAttachment" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseSchedule" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "beneficiary" TEXT NOT NULL,
    "frequency" "ExpenseFrequency" NOT NULL,
    "customFrequencyDays" INTEGER,
    "nextDueAt" TIMESTAMP(3) NOT NULL,
    "estimatedAmount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "reminderDays" INTEGER NOT NULL DEFAULT 7,
    "details" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseScheduleOccurrence" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseScheduleOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_slug_key" ON "ExpenseCategory"("slug");

-- CreateIndex
CREATE INDEX "ExpenseCategory_isActive_sortOrder_idx" ON "ExpenseCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_reference_key" ON "Expense"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_scheduledOccurrenceId_key" ON "Expense"("scheduledOccurrenceId");

-- CreateIndex
CREATE INDEX "Expense_categoryId_expenseDate_idx" ON "Expense"("categoryId", "expenseDate");

-- CreateIndex
CREATE INDEX "Expense_status_dueDate_idx" ON "Expense"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Expense_createdById_createdAt_idx" ON "Expense"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "Expense_beneficiary_idx" ON "Expense"("beneficiary");

-- CreateIndex
CREATE INDEX "Expense_periodStart_periodEnd_idx" ON "Expense"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "ExpensePayment_expenseId_paidAt_idx" ON "ExpensePayment"("expenseId", "paidAt");

-- CreateIndex
CREATE INDEX "ExpensePayment_paidAt_method_idx" ON "ExpensePayment"("paidAt", "method");

-- CreateIndex
CREATE INDEX "ExpensePayment_createdById_createdAt_idx" ON "ExpensePayment"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseAttachment_storagePath_key" ON "ExpenseAttachment"("storagePath");

-- CreateIndex
CREATE INDEX "ExpenseAttachment_expenseId_createdAt_idx" ON "ExpenseAttachment"("expenseId", "createdAt");

-- CreateIndex
CREATE INDEX "ExpenseSchedule_isActive_nextDueAt_idx" ON "ExpenseSchedule"("isActive", "nextDueAt");

-- CreateIndex
CREATE INDEX "ExpenseSchedule_categoryId_isActive_idx" ON "ExpenseSchedule"("categoryId", "isActive");

-- CreateIndex
CREATE INDEX "ExpenseScheduleOccurrence_scheduleId_createdAt_idx" ON "ExpenseScheduleOccurrence"("scheduleId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseScheduleOccurrence_scheduleId_dueAt_key" ON "ExpenseScheduleOccurrence"("scheduleId", "dueAt");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_scheduledOccurrenceId_fkey" FOREIGN KEY ("scheduledOccurrenceId") REFERENCES "ExpenseScheduleOccurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseAttachment" ADD CONSTRAINT "ExpenseAttachment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseAttachment" ADD CONSTRAINT "ExpenseAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseSchedule" ADD CONSTRAINT "ExpenseSchedule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseSchedule" ADD CONSTRAINT "ExpenseSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseScheduleOccurrence" ADD CONSTRAINT "ExpenseScheduleOccurrence_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ExpenseSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
