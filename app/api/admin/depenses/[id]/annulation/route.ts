import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/admin-api";
import { createExpenseAudit, isExpenseManager } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };
const cancellationSchema = z.object({
  decision: z.enum(["REQUEST", "APPROVE", "REJECT"]).default("REQUEST"),
  reason: z.string().trim().min(5).max(2000),
}).strict();

export async function POST(request: NextRequest, context: RouteContext) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  const { id } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = cancellationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Précise le motif et l’action d’annulation." }, { status: 400 });
  const isManager = isExpenseManager(staff.role);
  const canApprove = isManager || staff.canApproveExpenses;
  const decision = parsed.data.decision;
  if (decision !== "REQUEST" && !canApprove) {
    return NextResponse.json({ error: "Tu n’es pas habilité à approuver ou refuser cette annulation." }, { status: 403 });
  }
  try {
    const updated = await prisma.$transaction(async (transaction) => {
      const expense = await transaction.expense.findUnique({
        where: { id },
        include: { payments: { where: { isVoided: false }, select: { amount: true } } },
      });
      if (!expense) throw new Error("EXPENSE_NOT_FOUND");
      if (!isManager && !staff.canApproveExpenses && expense.createdById !== staff.userId) throw new Error("EXPENSE_FORBIDDEN");
      if (expense.status === "CANCELLED") throw new Error("EXPENSE_ALREADY_CANCELLED");
      if (expense.payments.length > 0) throw new Error("EXPENSE_HAS_PAYMENTS");
      if (decision === "REQUEST" && expense.cancellationStatus === "REQUESTED") throw new Error("CANCELLATION_ALREADY_REQUESTED");
      if (decision === "APPROVE" && expense.cancellationStatus !== "REQUESTED" && !canApprove) throw new Error("CANCELLATION_NOT_REQUESTED");
      if (decision === "REJECT" && expense.cancellationStatus !== "REQUESTED") throw new Error("CANCELLATION_NOT_REQUESTED");
      const approved = decision === "APPROVE" || (decision === "REQUEST" && isManager);
      const status = decision === "REJECT" ? "REJECTED" : approved ? "APPROVED" : "REQUESTED";
      const result = await transaction.expense.update({
        where: { id },
        data: {
          cancellationStatus: status,
          cancellationReason: parsed.data.reason,
          cancellationRequestedById: decision === "REQUEST" ? staff.userId : expense.cancellationRequestedById,
          cancellationRequestedAt: decision === "REQUEST" ? new Date() : expense.cancellationRequestedAt,
          cancellationApprovedById: approved ? staff.userId : null,
          cancellationApprovedAt: approved ? new Date() : null,
          ...(approved ? { status: "CANCELLED" } : {}),
          ...(decision === "REJECT" ? { status: expense.status } : {}),
          updatedById: staff.userId,
        },
      });
      await createExpenseAudit(transaction, {
        actorId: staff.userId,
        action: decision === "REJECT" ? "EXPENSE_CANCELLATION_REJECTED"
          : approved ? "EXPENSE_CANCELLED" : "EXPENSE_CANCELLATION_REQUESTED",
        targetId: id,
        result: decision === "REJECT" ? "REJECTED" : approved ? "APPROVED" : "PENDING_APPROVAL",
        reason: parsed.data.reason,
        details: { previousStatus: expense.status, cancellationStatus: result.cancellationStatus },
      });
      return result;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ expense: updated });
  } catch (failure) {
    if (failure instanceof Error) {
      if (failure.message === "EXPENSE_NOT_FOUND") return NextResponse.json({ error: "Dépense introuvable." }, { status: 404 });
      if (failure.message === "EXPENSE_FORBIDDEN") return NextResponse.json({ error: "Tu ne peux annuler que tes propres dépenses." }, { status: 403 });
      if (failure.message === "EXPENSE_ALREADY_CANCELLED") return NextResponse.json({ error: "Cette dépense est déjà annulée." }, { status: 409 });
      if (failure.message === "EXPENSE_HAS_PAYMENTS") return NextResponse.json({ error: "Une dépense comportant des paiements ne peut pas être annulée. Corrige d’abord les paiements." }, { status: 409 });
      if (failure.message === "CANCELLATION_ALREADY_REQUESTED") return NextResponse.json({ error: "Une demande d’annulation est déjà en attente." }, { status: 409 });
      if (failure.message === "CANCELLATION_NOT_REQUESTED") return NextResponse.json({ error: "Aucune demande d’annulation n’est en attente de décision." }, { status: 409 });
    }
    console.error("Expense cancellation POST:", failure);
    return NextResponse.json({ error: "Impossible de traiter l’annulation." }, { status: 500 });
  }
}
