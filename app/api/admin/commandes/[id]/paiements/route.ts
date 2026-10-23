import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };
const paymentSchema = z.object({
  requestKey: z.string().uuid(),
  sessionId: z.string().min(1),
  payments: z.array(z.object({
    amount: z.number().int().min(1).max(100_000_000_000),
    method: z.enum(["CASH", "MOBILE_MONEY", "BANK_TRANSFER"]),
    reference: z.string().trim().max(120).optional(),
  })).min(1).max(3),
});

export async function POST(request: NextRequest, context: RouteContext) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  if (!staff.userId) return NextResponse.json({ error: "Reconnecte-toi pour encaisser." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Vérifie le montant, la caisse et les moyens de paiement." }, { status: 400 });
  const { id } = await context.params;

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const session = await transaction.cashSession.findUnique({
        where: { id: parsed.data.sessionId },
        select: { id: true, status: true, activeUserId: true, registerId: true },
      });
      if (!session || session.status !== "OPEN") throw new Error("SESSION_NOT_OPEN");
      if (staff.role !== "ADMIN" && session.activeUserId !== staff.userId) throw new Error("SESSION_FORBIDDEN");
      const order = await transaction.customerOrder.findUnique({
        where: { id },
        include: {
          payments: { select: { amount: true } },
          lines: true,
          operations: { where: { type: { in: ["REFUND", "REVERSAL"] }, approvalStatus: "APPROVED" }, select: { amount: true } },
        },
      });
      if (!order || order.status === "CANCELLED") throw new Error("ORDER_UNAVAILABLE");
      if (staff.role !== "ADMIN" && order.createdByUserId !== staff.userId) throw new Error("ORDER_FORBIDDEN");
      const paid = order.payments.reduce((total, payment) => total + payment.amount, 0)
        - order.operations.reduce((sum, operation) => sum + operation.amount, 0);
      const paymentTotal = parsed.data.payments.reduce((total, payment) => total + payment.amount, 0);
      if (paymentTotal > order.totalAmount - paid) throw new Error("PAYMENT_EXCEEDS_REMAINING");

      const payments = [];
      for (const entry of parsed.data.payments) {
        const operation = await transaction.cashOperation.create({
          data: {
            registerId: session.registerId,
            sessionId: session.id,
            actorId: staff.userId!,
            orderId: order.id,
            type: "PAYMENT",
            method: entry.method,
            amount: entry.amount,
            reason: "Encaissement de commande",
          },
        });
        payments.push(await transaction.orderPayment.create({
          data: {
            orderId: order.id,
            sessionId: session.id,
            createdByUserId: staff.userId!,
            amount: entry.amount,
            method: entry.method,
            reference: entry.reference || null,
            requestKey: `${parsed.data.requestKey}:${payments.length}`,
            cashOperationId: operation.id,
          },
        }));
      }
      const stockLines = order.lines.filter((line) => line.productVariantId && line.stockLocationId && line.stockReservedAt && !line.stockIssuedAt);
      for (const line of stockLines) {
        const claimed = await transaction.orderLine.updateMany({
          where: { id: line.id, stockIssuedAt: null },
          data: { stockIssuedAt: new Date() },
        });
        if (claimed.count === 0) continue;
        const variantId = line.productVariantId!;
        const locationId = line.stockLocationId!;
        const variant = await transaction.productVariant.findUnique({ where: { id: variantId } });
        const balance = await transaction.productVariantBalance.findUnique({
          where: { variantId_locationId: { variantId, locationId } },
        });
        if (!variant || !balance
          || variant.quantityOnHand.lessThan(line.quantity)
          || variant.quantityReserved.lessThan(line.quantity)
          || balance.quantityOnHand.lessThan(line.quantity)
          || balance.quantityReserved.lessThan(line.quantity)) {
          throw new Error("STOCK_RESERVATION_INCONSISTENT");
        }
        await transaction.productVariant.update({
          where: { id: variantId },
          data: {
            quantityOnHand: { decrement: line.quantity },
            quantityReserved: { decrement: line.quantity },
          },
        });
        await transaction.productVariantBalance.update({
          where: { id: balance.id },
          data: {
            quantityOnHand: { decrement: line.quantity },
            quantityReserved: { decrement: line.quantity },
          },
        });
        const movement = await transaction.stockMovement.create({
          data: {
            productVariantId: variantId,
            locationId,
            actorId: staff.userId!,
            orderId: order.id,
            type: "ISSUE",
            quantity: line.quantity.negated(),
            reason: `Vente liée à la commande ${order.orderNumber}`,
            reference: order.invoiceNumber,
          },
        });
        await transaction.auditEvent.create({
          data: {
            actorId: staff.userId!,
            action: "STOCK_VARIANT_ISSUE",
            targetType: "ProductVariant",
            targetId: variantId,
            result: "SUCCESS",
            reason: movement.reason,
            details: { movementId: movement.id, orderId: order.id, orderLineId: line.id, quantity: line.quantity.toString(), locationId },
          },
        });
      }
      const newPaidAmount = paid + paymentTotal;
      const updatedOrder = await transaction.customerOrder.update({
        where: { id },
        data: { status: newPaidAmount >= order.totalAmount ? "PAID" : "PARTIALLY_PAID" },
      });
      await transaction.auditEvent.create({
        data: {
          actorId: staff.userId!,
          action: "ORDER_PAYMENT_RECORDED",
          targetType: "CustomerOrder",
          targetId: id,
          result: "SUCCESS",
          details: {
            invoiceNumber: order.invoiceNumber,
            payments: parsed.data.payments,
            paidTotal: newPaidAmount,
            remaining: order.totalAmount - newPaidAmount,
          },
        },
      });
      return { payments, order: updatedOrder, paidAmount: newPaidAmount };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json(result, { status: 201 });
  } catch (failure) {
    if (typeof failure === "object" && failure !== null && "code" in failure && failure.code === "P2002") {
      const existing = await prisma.orderPayment.findMany({
        where: { orderId: id, requestKey: { startsWith: `${parsed.data.requestKey}:` } },
        select: { id: true, requestKey: true },
      });
      const expectedKeys = parsed.data.payments.map((_, index) => `${parsed.data.requestKey}:${index}`);
      if (existing.length === expectedKeys.length && expectedKeys.every((key) => existing.some((payment) => payment.requestKey === key))) {
        return NextResponse.json({ alreadyRecorded: true }, { status: 200 });
      }
    }
    if (failure instanceof Error) {
      if (failure.message === "SESSION_NOT_OPEN") return NextResponse.json({ error: "La caisse est clôturée." }, { status: 409 });
      if (failure.message === "SESSION_FORBIDDEN") return NextResponse.json({ error: "Cette session ne t’appartient pas." }, { status: 403 });
      if (failure.message === "ORDER_UNAVAILABLE") return NextResponse.json({ error: "Commande introuvable ou annulée." }, { status: 404 });
      if (failure.message === "ORDER_FORBIDDEN") return NextResponse.json({ error: "Tu ne peux encaisser que tes commandes." }, { status: 403 });
      if (failure.message === "PAYMENT_EXCEEDS_REMAINING") return NextResponse.json({ error: "Le paiement dépasse le reste à payer." }, { status: 409 });
      if (failure.message === "STOCK_RESERVATION_INCONSISTENT") return NextResponse.json({ error: "La réservation de stock de cette commande n’est plus cohérente. Le paiement n’a pas été enregistré; demande l’intervention d’un responsable." }, { status: 409 });
    }
    console.error("Order payment POST:", failure);
    return NextResponse.json({ error: "Impossible d’enregistrer le paiement." }, { status: 500 });
  }
}
