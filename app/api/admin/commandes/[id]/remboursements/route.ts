import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };
const refundSchema = z.object({
  paymentId: z.string().min(1),
  sessionId: z.string().min(1),
  amount: z.number().int().min(1).max(100_000_000_000),
  reason: z.string().trim().min(5).max(2000),
});

export async function POST(request: NextRequest, context: RouteContext) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  if (!staff.userId) return NextResponse.json({ error: "Reconnecte-toi pour demander le remboursement." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = refundSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Sélectionne un paiement, une caisse, un montant et un motif." }, { status: 400 });
  const { id } = await context.params;

  try {
    const operation = await prisma.$transaction(async (transaction) => {
      const [order, payment, session] = await Promise.all([
        transaction.customerOrder.findUnique({ where: { id }, select: { id: true, createdByUserId: true } }),
        transaction.orderPayment.findUnique({ where: { id: parsed.data.paymentId }, include: { cashOperation: true } }),
        transaction.cashSession.findUnique({ where: { id: parsed.data.sessionId } }),
      ]);
      if (!order || !payment || payment.orderId !== order.id) throw new Error("PAYMENT_NOT_FOUND");
      if (staff.role !== "ADMIN" && order.createdByUserId !== staff.userId) throw new Error("ORDER_FORBIDDEN");
      if (!session || session.status !== "OPEN") throw new Error("SESSION_NOT_OPEN");
      if (staff.role !== "ADMIN" && session.activeUserId !== staff.userId) throw new Error("SESSION_FORBIDDEN");
      const previousRefunds = await transaction.cashOperation.aggregate({
        where: {
          reversalOfId: payment.cashOperationId,
          type: { in: ["REFUND", "REVERSAL"] },
          approvalStatus: { in: ["REQUESTED", "APPROVED"] },
        },
        _sum: { amount: true },
      });
      if (parsed.data.amount > payment.amount - (previousRefunds._sum.amount ?? 0)) throw new Error("REFUND_EXCEEDS_PAYMENT");
      const approved = staff.role === "ADMIN";
      const created = await transaction.cashOperation.create({
        data: {
          registerId: session.registerId,
          sessionId: session.id,
          actorId: staff.userId!,
          orderId: order.id,
          type: "REFUND",
          method: payment.method,
          amount: parsed.data.amount,
          approvalStatus: approved ? "APPROVED" : "REQUESTED",
          ...(approved ? { approverId: staff.userId! } : {}),
          reason: parsed.data.reason,
          reversalOfId: payment.cashOperationId,
        },
      });
      await transaction.auditEvent.create({
        data: {
          actorId: staff.userId!,
          action: "REFUND_REQUESTED",
          targetType: "CashOperation",
          targetId: created.id,
          result: approved ? "APPROVED" : "PENDING_APPROVAL",
          reason: parsed.data.reason,
          details: { orderId: order.id, paymentId: payment.id, amount: created.amount },
        },
      });
      return created;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ operation }, { status: 201 });
  } catch (failure) {
    if (failure instanceof Error) {
      if (failure.message === "PAYMENT_NOT_FOUND") return NextResponse.json({ error: "Paiement d’origine introuvable pour cette commande." }, { status: 404 });
      if (failure.message === "ORDER_FORBIDDEN" || failure.message === "SESSION_FORBIDDEN") return NextResponse.json({ error: "Tu n’es pas autorisé à demander ce remboursement." }, { status: 403 });
      if (failure.message === "SESSION_NOT_OPEN") return NextResponse.json({ error: "La caisse est clôturée." }, { status: 409 });
      if (failure.message === "REFUND_EXCEEDS_PAYMENT") return NextResponse.json({ error: "Le montant dépasse le solde remboursable de ce paiement." }, { status: 409 });
    }
    console.error("Refund request:", failure);
    return NextResponse.json({ error: "Impossible d’enregistrer la demande de remboursement." }, { status: 500 });
  }
}
