import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/admin-api";
import { MAX_EXPENSE_AMOUNT, paymentMethodSchema } from "@/lib/expense-validation";
import { createExpenseAudit, getExpenseStatus, todayInBenin, toValidDate } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };
const paymentSchema = z.object({
  amount: z.number().int().positive().max(MAX_EXPENSE_AMOUNT),
  method: paymentMethodSchema,
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: z.string().trim().max(120).optional().or(z.literal("")),
  comment: z.string().trim().max(1000).optional().or(z.literal("")),
}).strict();

export async function POST(request: NextRequest, context: RouteContext) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  const { id } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Le montant, le mode et la date du paiement sont obligatoires." }, { status: 400 });
  const paidAt = toValidDate(parsed.data.paidAt);
  if (!paidAt || paidAt.toISOString().slice(0, 10) > todayInBenin()) return NextResponse.json({ error: "La date du paiement est invalide ou future." }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const expense = await transaction.expense.findUnique({
        where: { id },
        include: { payments: { where: { isVoided: false }, select: { amount: true } } },
      });
      if (!expense) throw new Error("EXPENSE_NOT_FOUND");
      if (staff.role === "CASHIER" && expense.createdById !== staff.userId) throw new Error("EXPENSE_FORBIDDEN");
      if (expense.status === "CANCELLED" || expense.cancellationStatus === "REQUESTED") throw new Error("EXPENSE_NOT_PAYABLE");
      if (paidAt < expense.expenseDate) throw new Error("PAYMENT_BEFORE_EXPENSE");
      const paid = expense.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const remaining = expense.amount - paid;
      if (parsed.data.amount > remaining) throw new Error("PAYMENT_EXCEEDS_BALANCE");
      const payment = await transaction.expensePayment.create({
        data: {
          expenseId: id,
          amount: parsed.data.amount,
          method: parsed.data.method,
          paidAt,
          reference: parsed.data.reference || null,
          comment: parsed.data.comment || null,
          createdById: staff.userId,
        },
      });
      const status = getExpenseStatus(expense.amount, paid + payment.amount, expense.status);
      await transaction.expense.update({
        where: { id },
        data: { status, updatedById: staff.userId },
      });
      await createExpenseAudit(transaction, {
        actorId: staff.userId,
        action: "EXPENSE_PAYMENT_RECORDED",
        targetId: id,
        result: "SUCCESS",
        details: { paymentId: payment.id, amount: payment.amount, method: payment.method, paidAt: paidAt.toISOString(), status },
      });
      return { payment, paidAmount: paid + payment.amount, remainingAmount: remaining - payment.amount, status };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json(result, { status: 201 });
  } catch (failure) {
    if (failure instanceof Error) {
      if (failure.message === "EXPENSE_NOT_FOUND") return NextResponse.json({ error: "Dépense introuvable." }, { status: 404 });
      if (failure.message === "EXPENSE_FORBIDDEN") return NextResponse.json({ error: "Tu ne peux régler que tes propres dépenses." }, { status: 403 });
      if (failure.message === "EXPENSE_NOT_PAYABLE") return NextResponse.json({ error: "Cette dépense ne peut plus recevoir de paiement." }, { status: 409 });
      if (failure.message === "PAYMENT_BEFORE_EXPENSE") return NextResponse.json({ error: "Le paiement ne peut pas précéder la dépense." }, { status: 400 });
      if (failure.message === "PAYMENT_EXCEEDS_BALANCE") return NextResponse.json({ error: "Le paiement dépasse le solde restant." }, { status: 409 });
    }
    console.error("Expense payment POST:", failure);
    return NextResponse.json({ error: "Impossible d’enregistrer le paiement." }, { status: 500 });
  }
}
