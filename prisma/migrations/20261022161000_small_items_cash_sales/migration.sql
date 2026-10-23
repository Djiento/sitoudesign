ALTER TABLE "StockItem"
    ADD COLUMN "isForSale" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "unitPrice" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "salesCategory" "SalesCategory" NOT NULL DEFAULT 'OTHER';

ALTER TABLE "OrderLine" ADD COLUMN "stockItemId" TEXT;
CREATE INDEX "OrderLine_stockItemId_idx" ON "OrderLine"("stockItemId");
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_stockItemId_fkey"
    FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
