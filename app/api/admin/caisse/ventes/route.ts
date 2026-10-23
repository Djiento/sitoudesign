import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

const saleSchema = z.object({
  requestKey: z.string().uuid(),
  sessionId: z.string().min(1),
  categoryLabel: z.enum([
    "Impression en couleur",
    "Impression Blanc/noir",
    "Impression/papier special en couleur",
    "Impression/PVC",
    "photocopie en couleur",
    "photocopie Blanc/noir",
    "reliures",
    "Chemises cartonnées",
    "Enveloppe",
    "Article non répertorié",
  ]),
  customItem: z.string().trim().max(200).optional().default(""),
  quantity: z.number().positive().max(100_000),
  unitPrice: z.number().int().min(1).max(100_000_000_000),
  method: z.enum(["CASH", "MOBILE_MONEY", "BANK_TRANSFER"]),
}).refine((sale) => sale.categoryLabel !== "Article non répertorié" || sale.customItem.length >= 2, {
  message: "Indique le nom de l’article non répertorié.",
});

function categoryForReport(label: string): "GRAPHIC_DESIGN" | "PRINTING" | "ADVERTISING" | "OTHER" {
  if (label.startsWith("Impression") || label.startsWith("photocopie")) return "PRINTING";
  if (label === "reliures") return "GRAPHIC_DESIGN";
  if (label === "Chemises cartonnées" || label === "Enveloppe") return "ADVERTISING";
  return "OTHER";
}

export async function POST(request: NextRequest) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  if (!staff.userId) return NextResponse.json({ error: "Reconnecte-toi pour enregistrer une vente." }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const parsed = saleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Vérifie la catégorie, l’article personnalisé, la quantité, le tarif et le moyen de paiement." }, { status: 400 });
  }

  const total = Math.round(parsed.data.quantity * parsed.data.unitPrice);
  if (!Number.isSafeInteger(total) || total <= 0 || total > 100_000_000_000) {
    return NextResponse.json({ error: "Le montant total de la vente est invalide." }, { status: 400 });
  }

  try {
    const operation = await prisma.$transaction(async (transaction) => {
      const session = await transaction.cashSession.findUnique({
        where: { id: parsed.data.sessionId },
        select: { id: true, status: true, activeUserId: true, registerId: true },
      });
      if (!session || session.status !== "OPEN") throw new Error("SESSION_NOT_OPEN");
      if (staff.role !== "ADMIN" && session.activeUserId !== staff.userId) throw new Error("SESSION_FORBIDDEN");

      const description = parsed.data.categoryLabel === "Article non répertorié"
        ? parsed.data.customItem
        : parsed.data.customItem
          ? `${parsed.data.categoryLabel} · ${parsed.data.customItem}`
          : parsed.data.categoryLabel;
      const created = await transaction.cashOperation.create({
        data: {
          registerId: session.registerId,
          sessionId: session.id,
          actorId: staff.userId!,
          type: "PAYMENT",
          method: parsed.data.method,
          amount: total,
          saleDescription: description,
          saleQuantity: parsed.data.quantity,
          saleUnitPrice: parsed.data.unitPrice,
          salesCategory: categoryForReport(parsed.data.categoryLabel),
          saleCategoryLabel: parsed.data.categoryLabel,
          requestKey: parsed.data.requestKey,
          reason: `Vente comptoir · ${description}`,
          approvalStatus: "NOT_REQUIRED",
        },
      });
      await transaction.auditEvent.create({
        data: {
          actorId: staff.userId!,
          action: "CASH_COUNTER_SALE_RECORDED",
          targetType: "CashOperation",
          targetId: created.id,
          result: "SUCCESS",
          reason: description,
          details: {
            quantity: parsed.data.quantity,
            unitPrice: parsed.data.unitPrice,
            total,
            method: parsed.data.method,
            category: parsed.data.categoryLabel,
          },
        },
      });
      return created;
    }, { isolationLevel: "Serializable" });

    return NextResponse.json({ operation }, { status: 201 });
  } catch (failure) {
    if (typeof failure === "object" && failure !== null && "code" in failure && failure.code === "P2002") {
      const existing = await prisma.cashOperation.findUnique({ where: { requestKey: parsed.data.requestKey } });
      if (existing && existing.actorId === staff.userId) {
        return NextResponse.json({ operation: existing, alreadyRecorded: true });
      }
    }
    if (failure instanceof Error) {
      if (failure.message === "SESSION_NOT_OPEN") return NextResponse.json({ error: "La session de caisse est clôturée." }, { status: 409 });
      if (failure.message === "SESSION_FORBIDDEN") return NextResponse.json({ error: "Cette session ne t’appartient pas." }, { status: 403 });
    }
    console.error("Cash counter sale POST:", failure);
    return NextResponse.json({ error: "Impossible d’enregistrer la vente." }, { status: 500 });
  }
}
