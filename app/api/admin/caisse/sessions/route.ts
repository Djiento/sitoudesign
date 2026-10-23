import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

const openSchema = z.object({
  registerId: z.string().min(1),
  openingFloat: z.number().int().min(0).max(100_000_000_000),
  note: z.string().trim().max(1000).optional(),
});

export async function POST(request: NextRequest) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  if (!staff.userId) return NextResponse.json({ error: "Reconnecte-toi pour ouvrir une session." }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const parsed = openSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Sélectionne une caisse et saisis un fond initial valide." }, { status: 400 });

  try {
    const session = await prisma.$transaction(async (transaction) => {
      const register = await transaction.cashRegister.findFirst({
        where: { id: parsed.data.registerId, isActive: true },
        select: { id: true },
      });
      if (!register) throw new Error("REGISTER_UNAVAILABLE");
      const unresolvedVariance = await transaction.cashSession.findFirst({
        where: {
          openedByUserId: staff.userId!,
          status: "CLOSED",
          variance: { not: 0 },
          varianceReviewedAt: null,
        },
        select: { id: true },
        orderBy: [{ closedAt: "desc" }],
      });
      if (unresolvedVariance) throw new Error("VARIANCE_REVIEW_REQUIRED");
      const created = await transaction.cashSession.create({
        data: {
          registerId: register.id,
          openedByUserId: staff.userId!,
          activeUserId: staff.userId!,
          activeRegisterId: register.id,
          openingFloat: parsed.data.openingFloat,
          openingNote: parsed.data.note || null,
        },
      });
      await transaction.auditEvent.create({
        data: {
          actorId: staff.userId!,
          action: "CASH_SESSION_OPENED",
          targetType: "CashSession",
          targetId: created.id,
          result: "SUCCESS",
          details: { registerId: register.id, openingFloat: created.openingFloat },
        },
      });
      return created;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ session }, { status: 201 });
  } catch (failure) {
    if (failure instanceof Error && failure.message === "REGISTER_UNAVAILABLE") {
      return NextResponse.json({ error: "Cette caisse est inactive ou introuvable." }, { status: 404 });
    }
    if (failure instanceof Error && failure.message === "VARIANCE_REVIEW_REQUIRED") {
      return NextResponse.json({ error: "Une clôture précédente présente un écart non examiné. Un responsable doit la vérifier avant une nouvelle ouverture." }, { status: 409 });
    }
    if (typeof failure === "object" && failure !== null && "code" in failure && failure.code === "P2002") {
      return NextResponse.json({ error: "Tu as déjà une session ouverte ou cette caisse est déjà utilisée." }, { status: 409 });
    }
    console.error("Cash session open:", failure);
    return NextResponse.json({ error: "Impossible d’ouvrir la session de caisse." }, { status: 500 });
  }
}
