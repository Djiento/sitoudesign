import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/admin-api";
import { getStaffSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const movementSchema = z.object({
  locationId: z.string().min(1),
  destinationLocationId: z.string().min(1).optional(),
  orderId: z.string().trim().min(1).max(120).optional(),
  type: z.enum(["RECEIPT", "ISSUE", "RESERVATION", "RELEASE", "TRANSFER_OUT", "ADJUSTMENT"]),
  quantity: z.number().positive().max(1_000_000_000),
  direction: z.enum(["IN", "OUT"]).optional(),
  reason: z.string().trim().min(5).max(2000),
  reference: z.string().trim().max(120).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  const actor = await getStaffSession();
  if (!actor?.userId) {
    return NextResponse.json({ error: "Reconnecte-toi avec un compte administrateur pour enregistrer le mouvement." }, { status: 401 });
  }

  const { id: variantId } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = movementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Mouvement, quantité et motif obligatoires." }, { status: 400 });
  }
  if (staff.role !== "ADMIN" && staff.role !== "MANAGER"
    && !(staff.role === "CASHIER" && parsed.data.type === "ISSUE" && parsed.data.orderId)) {
    return NextResponse.json({ error: "Les caissiers peuvent uniquement enregistrer une sortie liée à leur commande." }, { status: 403 });
  }
  if (parsed.data.type === "TRANSFER_OUT" && (!parsed.data.destinationLocationId || parsed.data.destinationLocationId === parsed.data.locationId)) {
    return NextResponse.json({ error: "Choisis une destination distincte pour le transfert." }, { status: 400 });
  }

  const sign = parsed.data.type === "ADJUSTMENT"
    ? (parsed.data.direction === "OUT" ? -1 : 1)
    : ["ISSUE", "TRANSFER_OUT"].includes(parsed.data.type) ? -1 : 1;
  const quantityChange = parsed.data.quantity * sign;
  const stockChange = ["RESERVATION", "RELEASE", "TRANSFER_OUT"].includes(parsed.data.type) ? 0 : quantityChange;
  const locationStockChange = parsed.data.type === "TRANSFER_OUT" ? -parsed.data.quantity : stockChange;
  const movementQuantity = parsed.data.type === "RESERVATION"
    ? parsed.data.quantity
    : parsed.data.type === "RELEASE" || parsed.data.type === "TRANSFER_OUT"
      ? -parsed.data.quantity
      : quantityChange;
  const reservationChange = parsed.data.type === "RESERVATION"
    ? parsed.data.quantity
    : parsed.data.type === "RELEASE" ? -parsed.data.quantity : 0;

  try {
    const movement = await prisma.$transaction(async (transaction) => {
      const variant = await transaction.productVariant.findUnique({ where: { id: variantId } });
      if (!variant || !variant.isActive) throw new Error("VARIANT_UNAVAILABLE");
      const location = await transaction.stockLocation.findFirst({
        where: { id: parsed.data.locationId, isActive: true },
        select: { id: true },
      });
      if (!location) throw new Error("LOCATION_UNAVAILABLE");

      const sourceBalance = await transaction.productVariantBalance.upsert({
        where: { variantId_locationId: { variantId, locationId: location.id } },
        update: {},
        create: { variantId, locationId: location.id },
      });
      if (parsed.data.orderId) {
        const order = await transaction.customerOrder.findFirst({
          where: {
            id: parsed.data.orderId,
            status: { not: "CANCELLED" },
            ...(staff.role === "CASHIER" ? { createdByUserId: staff.userId! } : {}),
          },
          select: { id: true },
        });
        if (!order) throw new Error("ORDER_UNAVAILABLE");
      }

      const updatedOnHand = variant.quantityOnHand.plus(stockChange.toFixed(3));
      const updatedReserved = variant.quantityReserved.plus(reservationChange.toFixed(3));
      const updatedLocationOnHand = sourceBalance.quantityOnHand.plus(locationStockChange.toFixed(3));
      const updatedLocationReserved = sourceBalance.quantityReserved.plus(reservationChange.toFixed(3));
      if (
        updatedOnHand.lessThan(0) || updatedReserved.lessThan(0) || updatedReserved.greaterThan(updatedOnHand)
        || updatedLocationOnHand.lessThan(0) || updatedLocationReserved.lessThan(0)
        || updatedLocationReserved.greaterThan(updatedLocationOnHand)
      ) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      let destinationLocationId: string | null = null;
      if (parsed.data.type === "TRANSFER_OUT" && parsed.data.destinationLocationId) {
        const destination = await transaction.stockLocation.findFirst({
          where: { id: parsed.data.destinationLocationId, isActive: true },
          select: { id: true },
        });
        if (!destination) throw new Error("DESTINATION_UNAVAILABLE");
        destinationLocationId = destination.id;
        const destinationBalance = await transaction.productVariantBalance.upsert({
          where: { variantId_locationId: { variantId, locationId: destinationLocationId } },
          update: {},
          create: { variantId, locationId: destinationLocationId },
        });
        await transaction.productVariantBalance.update({
          where: { id: destinationBalance.id },
          data: { quantityOnHand: destinationBalance.quantityOnHand.plus(parsed.data.quantity.toFixed(3)) },
        });
      }

      await transaction.productVariant.update({
        where: { id: variantId },
        data: { quantityOnHand: updatedOnHand, quantityReserved: updatedReserved },
      });
      await transaction.productVariantBalance.update({
        where: { id: sourceBalance.id },
        data: { quantityOnHand: updatedLocationOnHand, quantityReserved: updatedLocationReserved },
      });
      const created = await transaction.stockMovement.create({
        data: {
          productVariantId: variantId,
          locationId: location.id,
          destinationLocationId,
          actorId: actor.userId,
          orderId: parsed.data.orderId || null,
          type: parsed.data.type,
          quantity: movementQuantity.toFixed(3),
          reason: parsed.data.reason,
          reference: parsed.data.reference || null,
        },
      });
      await transaction.auditEvent.create({
        data: {
          actorId: actor.userId,
          action: `STOCK_VARIANT_${parsed.data.type}`,
          targetType: "ProductVariant",
          targetId: variantId,
          result: "SUCCESS",
          reason: parsed.data.reason,
          details: {
            movementId: created.id,
            quantityChange: stockChange,
            reservationChange,
            orderId: parsed.data.orderId,
            locationId: location.id,
            destinationLocationId,
          },
        },
      });
      return created;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ movement }, { status: 201 });
  } catch (failure) {
    if (failure instanceof Error) {
      if (failure.message === "VARIANT_UNAVAILABLE") return NextResponse.json({ error: "Cette variante est inactive ou introuvable." }, { status: 404 });
      if (failure.message === "LOCATION_UNAVAILABLE" || failure.message === "DESTINATION_UNAVAILABLE") {
        return NextResponse.json({ error: "Emplacement introuvable ou inactif." }, { status: 404 });
      }
      if (failure.message === "ORDER_UNAVAILABLE") return NextResponse.json({ error: "Commande introuvable ou inaccessible." }, { status: 404 });
      if (failure.message === "INSUFFICIENT_STOCK") {
        return NextResponse.json({ error: "Stock disponible insuffisant ou réservation incohérente." }, { status: 409 });
      }
    }
    console.error("Stock variant movement POST:", failure);
    return NextResponse.json({ error: "Impossible d’enregistrer le mouvement de stock." }, { status: 500 });
  }
}
