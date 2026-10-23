ALTER TABLE "CashOperation"
    ADD COLUMN "saleDescription" TEXT,
    ADD COLUMN "saleUnit" TEXT,
    ADD COLUMN "saleQuantity" DECIMAL(12,3),
    ADD COLUMN "saleUnitPrice" INTEGER,
    ADD COLUMN "salesCategory" "SalesCategory",
    ADD COLUMN "requestKey" TEXT;

CREATE UNIQUE INDEX "CashOperation_requestKey_key" ON "CashOperation"("requestKey");
