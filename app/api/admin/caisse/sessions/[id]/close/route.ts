import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { calculateCashBalance } from "@/lib/cash-ledger";

type RouteContext = { params: Promise<{ id: string }> };
const closeSchema = z.object({
  countedClosing: z.number().int().min(0).max(100_000_000_000),
  note: z.string().trim().max(2000).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  if (!staff.userId) return NextResponse.json({ error: "Reconnecte-toi avant de clôturer la caisse." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = closeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Montant physique invalide." }, { status: 400 });
  const { id } = await context.params;

  try {
    const session = await prisma.$transaction(async (transaction) => {
      const current = await transaction.cashSession.findUnique({
        where: { id },
        select: { id: true, status: true, activeUserId: true, registerId: true, openingFloat: true },
      });
      if (!current || current.status !== "OPEN") throw new Error("SESSION_NOT_OPEN");
      if (staff.role !== "ADMIN" && current.activeUserId !== staff.userId) throw new Error("SESSION_FORBIDDEN");
      const pending = await transaction.cashOperation.count({
        where: { sessionId: id, approvalStatus: "REQUESTED" },
      });
      if (pending > 0) throw new Error("PENDING_APPROVALS");
      const operations = await transaction.cashOperation.findMany({
        where: {
          sessionId: id,
          method: "CASH",
          approvalStatus: { in: ["APPROVED", "NOT_REQUIRED"] },
        },
        select: { type: true, amount: true, reversalOf: { select: { type: true } } },
      });
      const expected = calculateCashBalance(current.openingFloat, operations);
      if (parsed.data.countedClosing !== expected && !parsed.data.note) {
        throw new Error("VARIANCE_REASON_REQUIRED");
      }
      const closedCount = await transaction.cashSession.updateMany({
        where: { id, status: "OPEN" },
        data: {
          status: "CLOSED",
          activeUserId: null,
          activeRegisterId: null,
          expectedClosing: expected,
          countedClosing: parsed.data.countedClosing,
          variance: parsed.data.countedClosing - expected,
          closingNote: parsed.data.note || null,
          closedAt: new Date(),
        },
      });
      if (closedCount.count !== 1) throw new Error("SESSION_NOT_OPEN");
      const closed = await transaction.cashSession.findUniqueOrThrow({ where: { id } });
      await transaction.auditEvent.create({
        data: {
          actorId: staff.userId!,
          action: "CASH_SESSION_CLOSED",
          targetType: "CashSession",
          targetId: id,
          result: "SUCCESS",
          reason: parsed.data.note || null,
          details: { expected, counted: parsed.data.countedClosing, variance: parsed.data.countedClosing - expected },
        },
      });
      return closed;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ session });
  } catch (failure) {
    if (typeof failure === "object" && failure !== null && "code" in failure && failure.code === "P2034") {
      return NextResponse.json({ error: "La session vient d’être clôturée par une autre opération. Actualise la caisse." }, { status: 409 });
    }
    if (failure instanceof Error) {
      if (failure.message === "SESSION_NOT_OPEN") return NextResponse.json({ error: "Cette session est déjà clôturée ou introuvable." }, { status: 409 });
      if (failure.message === "SESSION_FORBIDDEN") return NextResponse.json({ error: "Tu ne peux clôturer que ta propre session." }, { status: 403 });
      if (failure.message === "VARIANCE_REASON_REQUIRED") return NextResponse.json({ error: "Un motif est obligatoire lorsqu’il y a un écart de caisse." }, { status: 400 });
      if (failure.message === "PENDING_APPROVALS") return NextResponse.json({ error: "La session contient des opérations en attente d’approbation ; traite-les avant la clôture." }, { status: 409 });
    }
    console.error("Cash session close:", failure);
    return NextResponse.json({ error: "Impossible de clôturer la session." }, { status: 500 });
  }
}
