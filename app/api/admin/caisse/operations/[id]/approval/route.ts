import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { calculateCashBalance } from "@/lib/cash-ledger";

type RouteContext = { params: Promise<{ id: string }> };
const approvalSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().trim().min(5).max(2000),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  if (!staff.userId) return NextResponse.json({ error: "Reconnecte-toi pour valider cette opération." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = approvalSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Décision et motif obligatoires." }, { status: 400 });
  const { id } = await context.params;

  try {
    const operation = await prisma.$transaction(async (transaction) => {
      const current = await transaction.cashOperation.findUnique({
        where: { id },
        select: { type: true, approvalStatus: true, actorId: true, amount: true, sessionId: true, orderId: true, method: true },
      });
      if (!current || current.approvalStatus !== "REQUESTED") throw new Error("OPERATION_NOT_PENDING");
      const canApprove = staff.role === "ADMIN" || (current.type === "EXPENSE" && staff.userId !== current.actorId && staff.canApproveExpenses)
        || (["REFUND", "REVERSAL"].includes(current.type) && staff.userId !== current.actorId && staff.canApproveRefunds);
      if (!canApprove) throw new Error("APPROVAL_FORBIDDEN");
      if (
        parsed.data.decision === "APPROVED"
        && current.method === "CASH"
        && (current.type === "EXPENSE" || current.type === "REFUND")
      ) {
        if (!current.sessionId) throw new Error("SESSION_UNAVAILABLE");
        const session = await transaction.cashSession.findUnique({
          where: { id: current.sessionId },
          select: { status: true, openingFloat: true },
        });
        if (!session || session.status !== "OPEN") throw new Error("SESSION_CLOSED");
        const entries = await transaction.cashOperation.findMany({
          where: {
            sessionId: current.sessionId,
            id: { not: id },
            method: "CASH",
            approvalStatus: { in: ["APPROVED", "NOT_REQUIRED"] },
          },
          select: { type: true, amount: true, reversalOf: { select: { type: true } } },
        });
        if (calculateCashBalance(session.openingFloat, entries) < current.amount) throw new Error("INSUFFICIENT_CASH");
      }
      const updated = await transaction.cashOperation.update({
        where: { id },
        data: { approvalStatus: parsed.data.decision, approverId: staff.userId },
      });
      await transaction.auditEvent.create({
        data: {
          actorId: staff.userId!,
          action: `CASH_OPERATION_${parsed.data.decision}`,
          targetType: "CashOperation",
          targetId: id,
          result: "SUCCESS",
          reason: parsed.data.reason,
          details: { amount: current.amount, sessionId: current.sessionId, actorId: current.actorId },
        },
      });
      if (["REFUND", "REVERSAL"].includes(current.type) && current.orderId) {
        const order = await transaction.customerOrder.findUnique({
          where: { id: current.orderId },
          include: {
            payments: { select: { amount: true } },
          },
        });
        if (order) {
          const refunds = await transaction.cashOperation.aggregate({
            where: {
              orderId: order.id,
              type: { in: ["REFUND", "REVERSAL"] },
              approvalStatus: "APPROVED",
            },
            _sum: { amount: true },
          });
          const netPaid = order.payments.reduce((sum, payment) => sum + payment.amount, 0)
            - (refunds._sum.amount ?? 0);
          await transaction.customerOrder.update({
            where: { id: order.id },
            data: { status: netPaid >= order.totalAmount ? "PAID" : netPaid > 0 ? "PARTIALLY_PAID" : "OPEN" },
          });
        }
      }
      return updated;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ operation });
  } catch (failure) {
    if (failure instanceof Error) {
      if (failure.message === "OPERATION_NOT_PENDING") return NextResponse.json({ error: "Cette opération n’est plus en attente." }, { status: 409 });
      if (failure.message === "APPROVAL_FORBIDDEN") return NextResponse.json({ error: "Tu n’es pas autorisé à approuver cette opération." }, { status: 403 });
      if (failure.message === "SESSION_UNAVAILABLE" || failure.message === "SESSION_CLOSED") return NextResponse.json({ error: "La session liée est clôturée ou introuvable ; cette demande ne peut plus modifier son solde." }, { status: 409 });
      if (failure.message === "INSUFFICIENT_CASH") return NextResponse.json({ error: "Le solde théorique de cette caisse ne couvre pas le montant à approuver." }, { status: 409 });
    }
    console.error("Cash operation approval:", failure);
    return NextResponse.json({ error: "Impossible de traiter l’approbation." }, { status: 500 });
  }
}
