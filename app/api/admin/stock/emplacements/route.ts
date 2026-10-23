import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStaffSession } from "@/lib/admin-auth";
import { requireAdminOrManager } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

const locationSchema = z.object({ name: z.string().trim().min(2).max(80) });

export async function POST(request: NextRequest) {
  const authError = await requireAdminOrManager();
  if (authError) return authError;
  const actor = await getStaffSession();
  if (!actor?.userId) return NextResponse.json({ error: "Reconnecte-toi pour créer un emplacement." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = locationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Le nom de l’emplacement doit contenir au moins 2 caractères." }, { status: 400 });

  try {
    const location = await prisma.$transaction(async (transaction) => {
      const created = await transaction.stockLocation.create({ data: { name: parsed.data.name } });
      const items = await transaction.stockItem.findMany({ where: { isActive: true }, select: { id: true } });
      const variants = await transaction.productVariant.findMany({ where: { isActive: true }, select: { id: true } });
      if (items.length) {
        await transaction.stockBalance.createMany({
          data: items.map((item) => ({ itemId: item.id, locationId: created.id })),
        });
      }
      if (variants.length) {
        await transaction.productVariantBalance.createMany({
          data: variants.map((variant) => ({ variantId: variant.id, locationId: created.id })),
        });
      }
      await transaction.auditEvent.create({
        data: {
          actorId: actor.userId!,
          action: "STOCK_LOCATION_CREATED",
          targetType: "StockLocation",
          targetId: created.id,
          result: "SUCCESS",
          details: { name: created.name },
        },
      });
      return created;
    });
    return NextResponse.json({ location }, { status: 201 });
  } catch (failure) {
    if (typeof failure === "object" && failure !== null && "code" in failure && failure.code === "P2002") {
      return NextResponse.json({ error: "Cet emplacement existe déjà." }, { status: 409 });
    }
    console.error("Stock location POST:", failure);
    return NextResponse.json({ error: "Impossible de créer l’emplacement." }, { status: 500 });
  }
}
