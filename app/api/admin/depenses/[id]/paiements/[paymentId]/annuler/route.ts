import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/admin-api";
import { createExpenseAudit, getExpenseStatus, isExpenseManager } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string; paymentId: string }> };
const voidSchema = z.object({ reason: z.string().trim().min(5).max(1000) }).strict();

export async function POST(request: NextRequest, context: RouteContext) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  if (!isExpenseManager(staff.role) && !staff.canApproveExpenses) {
    return NextResponse.json({ error: "L’autorisation de corriger un paiement est réservée aux personnes habilitées." }, { status: 403 });
  }
  const { id, paymentId } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = voidSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Un motif de correction d’au moins cinq caractères est obligatoire." }, { status: 400 });
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const expense = await transaction.expense.findUnique({
        where: { id },
        include: { payments: { where: { isVoided: false }, select: { id: true, amount: true } } },
      });
      if (!expense) throw new Error("EXPENSE_NOT_FOUND");
      if (expense.status === "CANCELLED") throw new Error("EXPENSE_CANCELLED");
      const payment = expense.payments.find(({ id: currentId }) => currentId === paymentId);
      if (!payment) throw new Error("PAYMENT_NOT_FOUND");
      const voided = await transaction.expensePayment.update({
        where: { id: paymentId },
        data: {
          isVoided: true,
          voidReason: parsed.data.reason,
          voidedAt: new Date(),
          voidedById: staff.userId,
        },
      });
      const remainingPaid = expense.payments.reduce((sum, item) =>
        sum + (item.id === paymentId ? 0 : item.amount), 0);
      const status = getExpenseStatus(expense.amount, remainingPaid, expense.status);
      await transaction.expense.update({
        where: { id },
        data: { status, updatedById: staff.userId },
      });
      await createExpenseAudit(transaction, {
        actorId: staff.userId,
        action: "EXPENSE_PAYMENT_VOIDED",
        targetId: id,
        result: "SUCCESS",
        reason: parsed.data.reason,
        details: { paymentId, amount: payment.amount, status },
      });
      return { payment: voided, status, paidAmount: remainingPaid, remainingAmount: expense.amount - remainingPaid };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json(result);
  } catch (failure) {
    if (failure instanceof Error) {
      if (failure.message === "EXPENSE_NOT_FOUND") return NextResponse.json({ error: "Dépense introuvable." }, { status: 404 });
      if (failure.message === "EXPENSE_CANCELLED") return NextResponse.json({ error: "Le paiement d’une dépense annulée ne peut pas être corrigé." }, { status: 409 });
      if (failure.message === "PAYMENT_NOT_FOUND") return NextResponse.json({ error: "Paiement introuvable ou déjà corrigé." }, { status: 404 });
    }
    console.error("Expense payment correction POST:", failure);
    return NextResponse.json({ error: "Impossible de corriger le paiement." }, { status: 500 });
  }
}
