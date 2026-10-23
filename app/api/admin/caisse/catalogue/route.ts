import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;

  try {
    const [services, variants] = await Promise.all([
      prisma.service.findMany({
        where: { isActive: true, unitPrice: { gt: 0 } },
        select: { id: true, titleFr: true, titleEn: true, unitPrice: true, billingUnit: true, salesCategory: true },
        orderBy: [{ sortOrder: "asc" }, { titleFr: "asc" }],
      }),
      prisma.productVariant.findMany({
        where: { isActive: true, unitPrice: { gt: 0 } },
        select: {
          id: true, sku: true, color: true, size: true, unitPrice: true,
          quantityOnHand: true, quantityReserved: true,
          product: { select: { nameFr: true, nameEn: true } },
        },
        orderBy: [{ sku: "asc" }],
      }),
    ]);
    return NextResponse.json({ services, variants });
  } catch (failure) {
    console.error("Cash sales catalogue GET:", failure);
    return NextResponse.json({ error: "Impossible de charger le catalogue de vente." }, { status: 500 });
  }
}
