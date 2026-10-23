import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrManager } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

const variantSchema = z.object({
  productId: z.string().min(1),
  sku: z.string().trim().min(2).max(60).regex(/^[A-Za-z0-9._-]+$/),
  color: z.string().trim().max(60).optional().default(""),
  size: z.string().trim().max(60).optional().default(""),
  reorderThreshold: z.number().min(0).max(1_000_000_000),
  unitPrice: z.number().int().min(0).max(100_000_000_000),
}).refine((variant) => variant.color || variant.size, {
  message: "Une couleur ou une taille est nécessaire.",
});

export async function POST(request: NextRequest) {
  const authError = await requireAdminOrManager();
  if (authError) return authError;

  const body: unknown = await request.json().catch(() => null);
  const parsed = variantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Vérifie le produit, la référence, la couleur, la taille, le seuil et le tarif." }, { status: 400 });
  }

  try {
    const variant = await prisma.$transaction(async (transaction) => {
      const product = await transaction.product.findUnique({
        where: { id: parsed.data.productId },
        select: { id: true },
      });
      if (!product) throw new Error("PRODUCT_UNAVAILABLE");
      const duplicate = await transaction.productVariant.findFirst({
        where: {
          productId: product.id,
          color: parsed.data.color,
          size: parsed.data.size,
        },
        select: { id: true },
      });
      if (duplicate) throw new Error("VARIANT_COMBINATION_EXISTS");

      await transaction.stockLocation.upsert({
        where: { name: "Atelier" },
        update: {},
        create: { name: "Atelier" },
      });
      const locations = await transaction.stockLocation.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      return transaction.productVariant.create({
        data: {
          productId: product.id,
          sku: parsed.data.sku.toUpperCase(),
          color: parsed.data.color,
          size: parsed.data.size,
          reorderThreshold: parsed.data.reorderThreshold,
          balances: { create: locations.map((location) => ({ locationId: location.id })) },
        },
        include: {
          product: { select: { id: true, nameFr: true, nameEn: true } },
          balances: { include: { location: { select: { id: true, name: true } } } },
        },
      });
    });
    return NextResponse.json({ variant }, { status: 201 });
  } catch (failure) {
    if (failure instanceof Error && failure.message === "PRODUCT_UNAVAILABLE") {
      return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
    }
    if (failure instanceof Error && failure.message === "VARIANT_COMBINATION_EXISTS") {
      return NextResponse.json({ error: "Cette combinaison de couleur et de taille existe déjà pour ce produit." }, { status: 409 });
    }
    if (typeof failure === "object" && failure !== null && "code" in failure && failure.code === "P2002") {
      return NextResponse.json({ error: "Cette référence ou combinaison de variantes existe déjà." }, { status: 409 });
    }
    console.error("Stock variant POST:", failure);
    return NextResponse.json({ error: "Impossible de créer la variante." }, { status: 500 });
  }
}
