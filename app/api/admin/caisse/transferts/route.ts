import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

const transferSchema = z.object({
  sourceSessionId: z.string().min(1),
  destinationSessionId: z.string().min(1),
  amount: z.number().int().min(1).max(100_000_000_000),
  reason: z.string().trim().min(5).max(1000),
});

export async function POST(request: NextRequest) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  if (!staff.userId) return NextResponse.json({ error: "Reconnecte-toi pour initier un transfert." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = transferSchema.safeParse(body);
  if (!parsed.success || parsed.data.sourceSessionId === parsed.data.destinationSessionId) {
    return NextResponse.json({ error: "Choisis deux sessions distinctes et indique le montant et le motif." }, { status: 400 });
  }

  try {
    const transfer = await prisma.$transaction(async (transaction) => {
      const [source, destination] = await Promise.all([
        transaction.cashSession.findUnique({ where: { id: parsed.data.sourceSessionId } }),
        transaction.cashSession.findUnique({ where: { id: parsed.data.destinationSessionId } }),
      ]);
      if (!source || !destination || source.status !== "OPEN" || destination.status !== "OPEN") throw new Error("SESSION_NOT_OPEN");
      if (staff.role !== "ADMIN" && source.activeUserId !== staff.userId) throw new Error("SOURCE_FORBIDDEN");
      const created = await transaction.cashTransfer.create({
        data: {
          sourceRegisterId: source.registerId,
          destinationRegisterId: destination.registerId,
          sourceSessionId: source.id,
          destinationSessionId: destination.id,
          amount: parsed.data.amount,
          initiatedByUserId: staff.userId!,
          reason: parsed.data.reason,
        },
      });
      await transaction.auditEvent.create({
        data: {
          actorId: staff.userId!,
          action: "CASH_TRANSFER_REQUESTED",
          targetType: "CashTransfer",
          targetId: created.id,
          result: "PENDING_CONFIRMATION",
          reason: parsed.data.reason,
          details: { amount: created.amount, sourceRegisterId: source.registerId, destinationRegisterId: destination.registerId },
        },
      });
      return created;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ transfer }, { status: 201 });
  } catch (failure) {
    if (failure instanceof Error) {
      if (failure.message === "SESSION_NOT_OPEN") return NextResponse.json({ error: "Les deux sessions doivent être ouvertes." }, { status: 409 });
      if (failure.message === "SOURCE_FORBIDDEN") return NextResponse.json({ error: "Tu dois être le caissier de la caisse source." }, { status: 403 });
    }
    console.error("Cash transfer POST:", failure);
    return NextResponse.json({ error: "Impossible d’initier le transfert." }, { status: 500 });
  }
}
