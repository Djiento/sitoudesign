import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrManager, requireStaff } from "@/lib/admin-api";
import { parseAdminPagination } from "@/lib/admin-pagination";
import { prisma } from "@/lib/prisma";

const itemSchema = z.object({
  sku: z.string().trim().min(2).max(60).regex(/^[A-Za-z0-9._-]+$/),
  name: z.string().trim().min(2).max(160),
  unit: z.string().trim().min(1).max(30),
  reorderThreshold: z.number().min(0).max(1_000_000_000),
});

const movementSchema = z.object({
  itemId: z.string().min(1),
  locationId: z.string().min(1),
  destinationLocationId: z.string().optional(),
  orderId: z.string().trim().min(1).max(120).optional(),
  type: z.enum(["RECEIPT", "ISSUE", "RESERVATION", "RELEASE", "TRANSFER_OUT", "ADJUSTMENT"]),
  quantity: z.number().positive().max(1_000_000_000),
  direction: z.enum(["IN", "OUT"]).optional(),
  reason: z.string().trim().min(5).max(2000),
  reference: z.string().trim().max(120).optional(),
});

export async function GET(request: NextRequest) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  const search = request.nextUrl.searchParams.get("q")?.trim();
  const pagination = parseAdminPagination(request.nextUrl.searchParams);
  if (!pagination.success) {
    return NextResponse.json({ error: "Les paramètres de pagination sont invalides." }, { status: 400 });
  }
  const variantPagination = parseAdminPagination(new URLSearchParams({
    page: request.nextUrl.searchParams.get("variantPage") ?? "1",
    pageSize: request.nextUrl.searchParams.get("variantPageSize") ?? "25",
  }));
  if (!variantPagination.success) {
    return NextResponse.json({ error: "Les paramètres de pagination des variantes sont invalides." }, { status: 400 });
  }
  if (search && search.length > 200) return NextResponse.json({ error: "La recherche est trop longue." }, { status: 400 });
  try {
    await prisma.$transaction(async (transaction) => {
      const defaultLocation = await transaction.stockLocation.upsert({
        where: { name: "Atelier" },
        update: {},
        create: { name: "Atelier" },
        select: { id: true },
      });
      const itemsWithoutBalances = await transaction.stockItem.findMany({
        where: { balances: { none: {} } },
        select: { id: true, quantityOnHand: true, quantityReserved: true },
      });
      if (itemsWithoutBalances.length) {
        await transaction.stockBalance.createMany({
          data: itemsWithoutBalances.map((item) => ({
            itemId: item.id,
            locationId: defaultLocation.id,
            quantityOnHand: item.quantityOnHand,
            quantityReserved: item.quantityReserved,
          })),
          skipDuplicates: true,
        });
      }
    });
    const movementWhere = search ? {
      OR: [
        { item: { name: { contains: search, mode: "insensitive" as const } } },
        { item: { sku: { contains: search, mode: "insensitive" as const } } },
        { productVariant: { sku: { contains: search, mode: "insensitive" as const } } },
        { productVariant: { product: { nameFr: { contains: search, mode: "insensitive" as const } } } },
        { productVariant: { product: { nameEn: { contains: search, mode: "insensitive" as const } } } },
      ],
    } : {};
    const totalMovements = await prisma.stockMovement.count({ where: movementWhere });
    const totalMovementPages = Math.max(1, Math.ceil(totalMovements / pagination.data.pageSize));
    const movementPage = Math.min(pagination.data.page, totalMovementPages);
    const variantWhere = search ? {
      OR: [
        { sku: { contains: search, mode: "insensitive" as const } },
        { color: { contains: search, mode: "insensitive" as const } },
        { size: { contains: search, mode: "insensitive" as const } },
        { product: { nameFr: { contains: search, mode: "insensitive" as const } } },
        { product: { nameEn: { contains: search, mode: "insensitive" as const } } },
      ],
    } : {};
    const totalVariants = await prisma.productVariant.count({ where: variantWhere });
    const totalVariantPages = Math.max(1, Math.ceil(totalVariants / variantPagination.data.pageSize));
    const variantPage = Math.min(variantPagination.data.page, totalVariantPages);
    const [items, movements, locations, products, variants, allVariants] = await Promise.all([
      prisma.stockItem.findMany({
        where: {
          ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { sku: { contains: search, mode: "insensitive" } }] } : {}),
        },
        include: { balances: { include: { location: { select: { id: true, name: true } } } } },
        orderBy: [{ name: "asc" }],
      }),
      prisma.stockMovement.findMany({
        where: movementWhere,
        include: {
          item: { select: { id: true, sku: true, name: true, unit: true } },
          productVariant: {
            include: {
              product: { select: { id: true, nameFr: true, nameEn: true } },
            },
          },
          actor: { select: { id: true, fullName: true } },
          order: { select: { orderNumber: true } },
          location: { select: { id: true, name: true } },
          destinationLocation: { select: { id: true, name: true } },
        },
        orderBy: [{ createdAt: "desc" }],
        skip: (movementPage - 1) * pagination.data.pageSize,
        take: pagination.data.pageSize,
      }),
      prisma.stockLocation.findMany({ where: { isActive: true }, orderBy: [{ name: "asc" }] }),
      prisma.product.findMany({
        select: { id: true, nameFr: true, nameEn: true, slug: true },
        orderBy: [{ nameFr: "asc" }],
      }),
      prisma.productVariant.findMany({
        where: variantWhere,
        include: {
          product: { select: { id: true, nameFr: true, nameEn: true } },
          balances: { include: { location: { select: { id: true, name: true } } } },
        },
        orderBy: [{ sku: "asc" }],
        skip: (variantPage - 1) * variantPagination.data.pageSize,
        take: variantPagination.data.pageSize,
      }),
      prisma.productVariant.findMany({
        where: { isActive: true },
        select: {
          id: true, sku: true, color: true, size: true, quantityOnHand: true,
          quantityReserved: true, reorderThreshold: true, isActive: true,
          product: { select: { id: true, nameFr: true, nameEn: true } },
        },
        orderBy: [{ sku: "asc" }],
      }),
    ]);
    const lowStockCount = items.filter((item) => item.quantityOnHand.minus(item.quantityReserved).lessThanOrEqualTo(item.reorderThreshold)).length
      + allVariants.filter((variant) => variant.quantityOnHand.minus(variant.quantityReserved).lessThanOrEqualTo(variant.reorderThreshold)).length;
    const lowStockVariants = allVariants.filter((variant) => variant.quantityOnHand.minus(variant.quantityReserved).lessThanOrEqualTo(variant.reorderThreshold));
    return NextResponse.json({
      items, movements, locations, products, variants, lowStockCount, lowStockVariants,
      movementPagination: {
        page: movementPage,
        pageSize: pagination.data.pageSize,
        total: totalMovements,
        totalPages: totalMovementPages,
      },
      variantPagination: {
        page: variantPage,
        pageSize: variantPagination.data.pageSize,
        total: totalVariants,
        totalPages: totalVariantPages,
      },
    });
  } catch (failure) {
    console.error("Stock GET:", failure);
    return NextResponse.json({ error: "Impossible de charger le stock." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminOrManager();
  if (authError) return authError;
  const body: unknown = await request.json().catch(() => null);
  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Vérifie la référence, le nom, l’unité et le seuil d’alerte." }, { status: 400 });
  try {
    const item = await prisma.$transaction(async (transaction) => {
      const defaultLocation = await transaction.stockLocation.upsert({
        where: { name: "Atelier" },
        update: {},
        create: { name: "Atelier" },
      });
      const locations = await transaction.stockLocation.findMany({ where: { isActive: true }, select: { id: true } });
      if (!locations.some((location) => location.id === defaultLocation.id)) locations.push(defaultLocation);
      return transaction.stockItem.create({
        data: {
          ...parsed.data,
          sku: parsed.data.sku.toUpperCase(),
          balances: {
            create: locations.map((location) => ({ locationId: location.id })),
          },
        },
      });
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (failure) {
    if (typeof failure === "object" && failure !== null && "code" in failure && failure.code === "P2002") {
      return NextResponse.json({ error: "Cette référence matière existe déjà." }, { status: 409 });
    }
    console.error("Stock item POST:", failure);
    return NextResponse.json({ error: "Impossible de créer la fiche matière." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  if (!staff.userId) return NextResponse.json({ error: "Reconnecte-toi pour enregistrer le mouvement." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = movementSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Mouvement, quantité et motif obligatoires." }, { status: 400 });
  if (staff.role !== "ADMIN" && staff.role !== "MANAGER"
    && !(staff.role === "CASHIER" && parsed.data.type === "ISSUE" && parsed.data.orderId)) {
    return NextResponse.json({ error: "Les caissiers peuvent uniquement enregistrer une sortie liée à leur commande." }, { status: 403 });
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
  if (parsed.data.type === "TRANSFER_OUT" && (!parsed.data.destinationLocationId || parsed.data.destinationLocationId === parsed.data.locationId)) {
    return NextResponse.json({ error: "Choisis une destination distincte pour le transfert." }, { status: 400 });
  }

  try {
    const movement = await prisma.$transaction(async (transaction) => {
      const item = await transaction.stockItem.findUnique({ where: { id: parsed.data.itemId } });
      if (!item || !item.isActive) throw new Error("ITEM_UNAVAILABLE");
      const location = await transaction.stockLocation.findFirst({
        where: { id: parsed.data.locationId, isActive: true },
        select: { id: true },
      });
      if (!location) throw new Error("LOCATION_UNAVAILABLE");
      const sourceBalance = await transaction.stockBalance.upsert({
        where: { itemId_locationId: { itemId: item.id, locationId: location.id } },
        update: {},
        create: { itemId: item.id, locationId: location.id },
      });
      if (parsed.data.orderId) {
        const order = await transaction.customerOrder.findFirst({
          where: {
            id: parsed.data.orderId,
            ...(staff.role !== "ADMIN" ? { createdByUserId: staff.userId } : {}),
            status: { not: "CANCELLED" },
          },
          select: { id: true },
        });
        if (!order) throw new Error("ORDER_UNAVAILABLE");
      }
      const updatedOnHand = item.quantityOnHand.plus(stockChange.toFixed(3));
      const updatedReserved = item.quantityReserved.plus(reservationChange.toFixed(3));
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
      }
      await transaction.stockItem.update({
        where: { id: item.id },
        data: { quantityOnHand: updatedOnHand, quantityReserved: updatedReserved },
      });
      await transaction.stockBalance.update({
        where: { id: sourceBalance.id },
        data: {
          quantityOnHand: updatedLocationOnHand,
          quantityReserved: updatedLocationReserved,
        },
      });
      if (destinationLocationId) {
        const destinationBalance = await transaction.stockBalance.upsert({
          where: { itemId_locationId: { itemId: item.id, locationId: destinationLocationId } },
          update: { quantityOnHand: { increment: parsed.data.quantity } },
          create: { itemId: item.id, locationId: destinationLocationId, quantityOnHand: parsed.data.quantity },
        });
        if (destinationBalance.quantityReserved.greaterThan(destinationBalance.quantityOnHand)) {
          throw new Error("INSUFFICIENT_STOCK");
        }
      }
      const created = await transaction.stockMovement.create({
        data: {
          itemId: item.id,
          locationId: location.id,
          destinationLocationId,
          actorId: staff.userId!,
          orderId: parsed.data.orderId || null,
          type: parsed.data.type,
          quantity: movementQuantity.toFixed(3),
          reason: parsed.data.reason,
          reference: parsed.data.reference || null,
        },
      });
      await transaction.auditEvent.create({
        data: {
          actorId: staff.userId!,
          action: `STOCK_${parsed.data.type}`,
          targetType: "StockItem",
          targetId: item.id,
          result: "SUCCESS",
          reason: parsed.data.reason,
          details: { movementId: created.id, quantityChange: stockChange, reservationChange, orderId: parsed.data.orderId, locationId: location.id, destinationLocationId },
        },
      });
      return created;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ movement }, { status: 201 });
  } catch (failure) {
    if (failure instanceof Error) {
      if (failure.message === "ITEM_UNAVAILABLE") return NextResponse.json({ error: "Cette fiche matière est inactive ou introuvable." }, { status: 404 });
      if (failure.message === "LOCATION_UNAVAILABLE" || failure.message === "DESTINATION_UNAVAILABLE") return NextResponse.json({ error: "Emplacement introuvable ou inactif." }, { status: 404 });
      if (failure.message === "ORDER_UNAVAILABLE") return NextResponse.json({ error: "Commande introuvable ou inaccessible." }, { status: 404 });
      if (failure.message === "INSUFFICIENT_STOCK") return NextResponse.json({ error: "Stock disponible insuffisant ou réservation incohérente." }, { status: 409 });
    }
    console.error("Stock movement POST:", failure);
    return NextResponse.json({ error: "Impossible d’enregistrer le mouvement de stock." }, { status: 500 });
  }
}
