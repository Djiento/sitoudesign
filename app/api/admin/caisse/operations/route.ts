import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { calculateCashBalance } from "@/lib/cash-ledger";

const expenseSchema = z.object({
  sessionId: z.string().min(1),
  amount: z.number().int().min(1).max(100_000_000_000),
  method: z.enum(["CASH", "MOBILE_MONEY", "BANK_TRANSFER"]),
  expenseCategory: z.string().trim().min(2).max(100),
  reason: z.string().trim().min(5).max(2000),
  receiptUrl: z.string().url().max(2000).optional().or(z.literal("")),
});

export async function POST(request: NextRequest) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  if (!staff.userId) return NextResponse.json({ error: "Reconnecte-toi pour enregistrer une dépense." }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Catégorie, montant et motif sont obligatoires." }, { status: 400 });

  try {
    const operation = await prisma.$transaction(async (transaction) => {
      const session = await transaction.cashSession.findUnique({
        where: { id: parsed.data.sessionId },
        select: { status: true, activeUserId: true, registerId: true },
      });
      if (!session || session.status !== "OPEN") throw new Error("SESSION_NOT_OPEN");
      if (staff.role !== "ADMIN" && session.activeUserId !== staff.userId) throw new Error("SESSION_FORBIDDEN");
      const autoApproved = staff.role === "ADMIN";
      if (autoApproved && parsed.data.method === "CASH") {
        const cashSession = await transaction.cashSession.findUnique({
          where: { id: parsed.data.sessionId },
          select: { openingFloat: true },
        });
        const operations = await transaction.cashOperation.findMany({
          where: {
            sessionId: parsed.data.sessionId,
            method: "CASH",
            approvalStatus: { in: ["APPROVED", "NOT_REQUIRED"] },
          },
          select: { type: true, amount: true, reversalOf: { select: { type: true } } },
        });
        if (!cashSession || calculateCashBalance(cashSession.openingFloat, operations) < parsed.data.amount) {
          throw new Error("INSUFFICIENT_CASH");
        }
      }
      const created = await transaction.cashOperation.create({
        data: {
          registerId: session.registerId,
          sessionId: parsed.data.sessionId,
          actorId: staff.userId!,
          type: "EXPENSE",
          method: parsed.data.method,
          amount: parsed.data.amount,
          expenseCategory: parsed.data.expenseCategory,
          reason: parsed.data.reason,
          receiptUrl: parsed.data.receiptUrl || null,
          approvalStatus: autoApproved ? "APPROVED" : "REQUESTED",
          ...(autoApproved ? { approverId: staff.userId! } : {}),
        },
      });
      await transaction.auditEvent.create({
        data: {
          actorId: staff.userId!,
          action: "CASH_EXPENSE_REQUESTED",
          targetType: "CashOperation",
          targetId: created.id,
          result: autoApproved ? "APPROVED" : "PENDING_APPROVAL",
          reason: parsed.data.reason,
          details: { amount: parsed.data.amount, method: parsed.data.method, expenseCategory: parsed.data.expenseCategory },
        },
      });
      return created;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ operation }, { status: 201 });
  } catch (failure) {
    if (failure instanceof Error) {
      if (failure.message === "SESSION_NOT_OPEN") return NextResponse.json({ error: "La session de caisse est clôturée." }, { status: 409 });
      if (failure.message === "SESSION_FORBIDDEN") return NextResponse.json({ error: "Cette session ne t’appartient pas." }, { status: 403 });
      if (failure.message === "INSUFFICIENT_CASH") return NextResponse.json({ error: "Le solde théorique de la caisse ne couvre pas cette dépense." }, { status: 409 });
    }
    console.error("Cash expense POST:", failure);
    return NextResponse.json({ error: "Impossible d’enregistrer la dépense." }, { status: 500 });
  }
}
