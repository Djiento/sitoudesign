ALTER TABLE "Service"
    ADD COLUMN "unitPrice" INTEGER,
    ADD COLUMN "billingUnit" TEXT,
    ADD COLUMN "salesCategory" "SalesCategory" NOT NULL DEFAULT 'OTHER';

ALTER TABLE "ProductVariant"
    ADD COLUMN "unitPrice" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "OrderLine"
    ADD COLUMN "serviceId" TEXT,
    ADD COLUMN "productVariantId" TEXT,
    ADD COLUMN "stockLocationId" TEXT,
    ADD COLUMN "stockReservedAt" TIMESTAMP(3),
    ADD COLUMN "stockIssuedAt" TIMESTAMP(3);

ALTER TABLE "CustomerOrder" ADD COLUMN "requestKey" TEXT;
ALTER TABLE "OrderPayment" ADD COLUMN "requestKey" TEXT;

CREATE UNIQUE INDEX "CustomerOrder_requestKey_key" ON "CustomerOrder"("requestKey");
CREATE UNIQUE INDEX "OrderPayment_requestKey_key" ON "OrderPayment"("requestKey");
CREATE INDEX "OrderLine_serviceId_idx" ON "OrderLine"("serviceId");
CREATE INDEX "OrderLine_productVariantId_idx" ON "OrderLine"("productVariantId");
CREATE INDEX "OrderLine_stockLocationId_idx" ON "OrderLine"("stockLocationId");
CREATE INDEX "OrderLine_stockIssuedAt_idx" ON "OrderLine"("stockIssuedAt");

ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_productVariantId_fkey"
    FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_stockLocationId_fkey"
    FOREIGN KEY ("stockLocationId") REFERENCES "StockLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
