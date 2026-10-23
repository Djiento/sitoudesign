import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrManager } from "@/lib/admin-api";
import { getStaffSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  unitPrice: z.number().int().min(0).max(100_000_000_000).optional(),
  reorderThreshold: z.number().min(0).max(1_000_000_000).optional(),
  isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0);

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const authError = await requireAdminOrManager();
  if (authError) return authError;
  const actor = await getStaffSession();
  if (!actor?.userId) return NextResponse.json({ error: "Reconnecte-toi pour modifier cette variante." }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Le tarif ou le seuil de stock est invalide." }, { status: 400 });

  try {
    const { id } = await params;
    const variant = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.productVariant.update({
        where: { id },
        data: parsed.data,
        select: { id: true, sku: true, unitPrice: true, reorderThreshold: true, isActive: true },
      });
      await transaction.auditEvent.create({
        data: {
          actorId: actor.userId,
          action: "STOCK_VARIANT_UPDATED",
          targetType: "ProductVariant",
          targetId: id,
          result: "SUCCESS",
          details: parsed.data,
        },
      });
      return updated;
    });
    return NextResponse.json({ variant });
  } catch (failure) {
    if (typeof failure === "object" && failure !== null && "code" in failure && failure.code === "P2025") {
      return NextResponse.json({ error: "Variante introuvable." }, { status: 404 });
    }
    console.error("Stock variant PATCH:", failure);
    return NextResponse.json({ error: "Impossible de modifier cette variante." }, { status: 500 });
  }
}
