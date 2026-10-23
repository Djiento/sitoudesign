export type CashLedgerEntry = {
  type: string;
  amount: number;
  reversalOf?: { type: string } | null;
};

export function calculateCashBalance(openingFloat: number, operations: readonly CashLedgerEntry[]) {
  return operations.reduce((balance, operation) => {
    if (operation.type === "PAYMENT" || operation.type === "TRANSFER_IN") return balance + operation.amount;
    if (operation.type === "EXPENSE" || operation.type === "REFUND" || operation.type === "TRANSFER_OUT") {
      return balance - operation.amount;
    }
    if (operation.type === "REVERSAL" && operation.reversalOf) {
      return balance + (operation.reversalOf.type === "PAYMENT" || operation.reversalOf.type === "TRANSFER_IN"
        ? -operation.amount : operation.amount);
    }
    return balance;
  }, openingFloat);
}
