import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-api";
import { getStaffSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };
const reviewSchema = z.object({ reason: z.string().trim().min(5).max(2000) });

export async function POST(request: NextRequest, context: RouteContext) {
  const authError = await requireAdmin();
  if (authError) return authError;
  const actor = await getStaffSession();
  if (!actor?.userId) return NextResponse.json({ error: "Reconnecte-toi pour examiner l’écart." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Un motif d’examen est obligatoire." }, { status: 400 });
  const { id } = await context.params;

  try {
    const session = await prisma.$transaction(async (transaction) => {
      const current = await transaction.cashSession.findUnique({
        where: { id },
        select: { status: true, variance: true, varianceReviewedAt: true, openedByUserId: true },
      });
      if (!current || current.status !== "CLOSED" || current.variance == null || current.variance === 0) {
        throw new Error("VARIANCE_NOT_REVIEWABLE");
      }
      if (current.varianceReviewedAt) throw new Error("VARIANCE_ALREADY_REVIEWED");
      const reviewed = await transaction.cashSession.update({
        where: { id },
        data: { varianceReviewedAt: new Date(), varianceReviewedByUserId: actor.userId },
      });
      await transaction.auditEvent.create({
        data: {
          actorId: actor.userId!,
          action: "CASH_SESSION_VARIANCE_REVIEWED",
          targetType: "CashSession",
          targetId: id,
          result: "SUCCESS",
          reason: parsed.data.reason,
          details: { variance: current.variance, cashierId: current.openedByUserId },
        },
      });
      return reviewed;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ session });
  } catch (failure) {
    if (failure instanceof Error && failure.message === "VARIANCE_NOT_REVIEWABLE") {
      return NextResponse.json({ error: "Aucun écart clôturé à examiner pour cette session." }, { status: 409 });
    }
    if (failure instanceof Error && failure.message === "VARIANCE_ALREADY_REVIEWED") {
      return NextResponse.json({ error: "Cet écart a déjà été examiné." }, { status: 409 });
    }
    console.error("Cash session variance review:", failure);
    return NextResponse.json({ error: "Impossible d’examiner l’écart." }, { status: 500 });
  }
}
