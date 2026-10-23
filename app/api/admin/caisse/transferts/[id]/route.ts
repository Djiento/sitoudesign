import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { calculateCashBalance } from "@/lib/cash-ledger";

type RouteContext = { params: Promise<{ id: string }> };
const confirmSchema = z.object({ confirm: z.boolean(), reason: z.string().trim().min(5).max(1000) });

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  if (!staff.userId) return NextResponse.json({ error: "Reconnecte-toi pour confirmer le transfert." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Confirmation et motif obligatoires." }, { status: 400 });
  const { id } = await context.params;

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const transfer = await transaction.cashTransfer.findUnique({ where: { id } });
      if (!transfer || transfer.status !== "REQUESTED" || !transfer.destinationSessionId) throw new Error("TRANSFER_NOT_PENDING");
      const destination = await transaction.cashSession.findUnique({ where: { id: transfer.destinationSessionId } });
      const source = await transaction.cashSession.findUnique({ where: { id: transfer.sourceSessionId } });
      if (!destination || !source || destination.status !== "OPEN" || source.status !== "OPEN") throw new Error("SESSION_NOT_OPEN");
      if (staff.role !== "ADMIN" && destination.activeUserId !== staff.userId) throw new Error("DESTINATION_FORBIDDEN");
      const sourceOperations = await transaction.cashOperation.findMany({
        where: {
          sessionId: source.id,
          method: "CASH",
          approvalStatus: { in: ["APPROVED", "NOT_REQUIRED"] },
        },
        select: { type: true, amount: true, reversalOf: { select: { type: true } } },
      });
      if (calculateCashBalance(source.openingFloat, sourceOperations) < transfer.amount) {
        throw new Error("INSUFFICIENT_SOURCE_CASH");
      }

      const updated = await transaction.cashTransfer.update({
        where: { id },
        data: {
          status: parsed.data.confirm ? "APPROVED" : "REJECTED",
          confirmedByUserId: staff.userId,
          confirmedAt: new Date(),
        },
      });
      if (parsed.data.confirm) {
        await transaction.cashOperation.createMany({
          data: [
            {
              registerId: source.registerId,
              sessionId: source.id,
              actorId: transfer.initiatedByUserId,
              approverId: staff.userId,
              type: "TRANSFER_OUT",
              method: "CASH",
              amount: transfer.amount,
              approvalStatus: "APPROVED",
              reason: transfer.reason,
              transferGroupId: transfer.id,
            },
            {
              registerId: destination.registerId,
              sessionId: destination.id,
              actorId: staff.userId!,
              approverId: staff.userId,
              type: "TRANSFER_IN",
              method: "CASH",
              amount: transfer.amount,
              approvalStatus: "APPROVED",
              reason: transfer.reason,
              transferGroupId: transfer.id,
            },
          ],
        });
      }
      await transaction.auditEvent.create({
        data: {
          actorId: staff.userId!,
          action: parsed.data.confirm ? "CASH_TRANSFER_CONFIRMED" : "CASH_TRANSFER_REJECTED",
          targetType: "CashTransfer",
          targetId: id,
          result: "SUCCESS",
          reason: parsed.data.reason,
          details: { amount: transfer.amount, sourceSessionId: source.id, destinationSessionId: destination.id },
        },
      });
      return updated;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ transfer: result });
  } catch (failure) {
    if (failure instanceof Error) {
      if (failure.message === "TRANSFER_NOT_PENDING") return NextResponse.json({ error: "Ce transfert n’est plus en attente." }, { status: 409 });
      if (failure.message === "SESSION_NOT_OPEN") return NextResponse.json({ error: "Une des sessions est clôturée." }, { status: 409 });
      if (failure.message === "DESTINATION_FORBIDDEN") return NextResponse.json({ error: "Seul le destinataire peut confirmer ce transfert." }, { status: 403 });
      if (failure.message === "INSUFFICIENT_SOURCE_CASH") return NextResponse.json({ error: "Le solde disponible de la caisse source ne couvre pas le transfert." }, { status: 409 });
    }
    console.error("Cash transfer confirmation:", failure);
    return NextResponse.json({ error: "Impossible de confirmer le transfert." }, { status: 500 });
  }
}
