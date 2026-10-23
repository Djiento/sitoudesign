import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireStaff } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { parseAdminPagination } from "@/lib/admin-pagination";

const categorySchema = z.enum(["GRAPHIC_DESIGN", "PRINTING", "ADVERTISING", "OTHER"]);
type SaleVariant = Prisma.ProductVariantGetPayload<{
  include: {
    product: { select: { nameFr: true } };
    balances: { include: { location: { select: { id: true; name: true; isActive: true } } } };
  };
}>;
const orderSchema = z.object({
  requestKey: z.string().uuid(),
  quoteRequestId: z.string().optional(),
  customerName: z.string().trim().min(2).max(160),
  customerEmail: z.string().trim().email().max(254).optional().or(z.literal("")),
  customerPhone: z.string().trim().max(40).optional(),
  category: categorySchema,
  discountAmount: z.number().int().min(0).max(100_000_000_000).default(0),
  notes: z.string().trim().max(3000).optional(),
  lines: z.array(z.object({
    description: z.string().trim().min(2).max(500).optional(),
    quantity: z.number().positive().max(100000),
    unitPrice: z.number().int().min(0).max(100_000_000_000).optional(),
    category: categorySchema.optional().default("OTHER"),
    serviceId: z.string().min(1).optional(),
    productVariantId: z.string().min(1).optional(),
  }).refine((line) => {
    const catalogueIds = [line.serviceId, line.productVariantId].filter(Boolean).length;
    return catalogueIds <= 1
      && (catalogueIds === 1 || (line.description && line.unitPrice !== undefined));
  }, "Une ligne doit contenir un service, une variante ou un libellé et un tarif." )).min(1).max(50),
});

function newNumber(prefix: string) {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `${prefix}-${day}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function GET(request: NextRequest) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  const search = request.nextUrl.searchParams.get("q")?.trim();
  const status = request.nextUrl.searchParams.get("status");
  const pagination = parseAdminPagination(request.nextUrl.searchParams);
  if (!pagination.success) {
    return NextResponse.json({ error: "Les paramètres de pagination sont invalides." }, { status: 400 });
  }
  if (search && search.length > 200) {
    return NextResponse.json({ error: "La recherche est trop longue." }, { status: 400 });
  }
  const where = {
    ...(staff.role !== "ADMIN" ? { createdByUserId: staff.userId! } : {}),
    ...(status && ["OPEN", "PARTIALLY_PAID", "PAID", "CANCELLED"].includes(status) ? { status: status as "OPEN" | "PARTIALLY_PAID" | "PAID" | "CANCELLED" } : {}),
    ...(search ? {
      OR: [
        { orderNumber: { contains: search, mode: "insensitive" as const } },
        { invoiceNumber: { contains: search, mode: "insensitive" as const } },
        { customerName: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
  };
  try {
    const total = await prisma.customerOrder.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pagination.data.pageSize));
    const page = Math.min(pagination.data.page, totalPages);
    const orders = await prisma.customerOrder.findMany({
      where,
      include: {
        payments: { orderBy: { createdAt: "desc" } },
        operations: { where: { type: { in: ["REFUND", "REVERSAL"] }, approvalStatus: "APPROVED" }, select: { amount: true } },
        createdBy: { select: { fullName: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pagination.data.pageSize,
      take: pagination.data.pageSize,
    });
    return NextResponse.json({
      orders: orders.map((order) => {
        const paidAmount = order.payments.reduce((sum, payment) => sum + payment.amount, 0)
          - order.operations.reduce((sum, operation) => sum + operation.amount, 0);
        return { ...order, paidAmount, remainingAmount: order.totalAmount - paidAmount };
      }),
      pagination: { page, pageSize: pagination.data.pageSize, total, totalPages },
    });
  } catch (failure) {
    console.error("Orders GET:", failure);
    return NextResponse.json({ error: "Impossible de charger les commandes." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  if (!staff.userId) return NextResponse.json({ error: "Reconnecte-toi pour enregistrer une commande." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Vérifie le client, les lignes et les tarifs de la commande." }, { status: 400 });

  try {
    const order = await prisma.$transaction(async (transaction) => {
      const variantCache = new Map<string, SaleVariant | null>();
      const serviceCache = new Map<string, Awaited<ReturnType<typeof transaction.service.findUnique>>>();
      const demandByVariant = new Map<string, number>();
      const normalizedLines: {
        description: string;
        quantity: number;
        unitPrice: number;
        total: number;
        category: "GRAPHIC_DESIGN" | "PRINTING" | "ADVERTISING" | "OTHER";
        serviceId?: string;
        productVariantId?: string;
      }[] = [];

      for (const line of parsed.data.lines) {
        if (line.productVariantId) {
          let variant = variantCache.get(line.productVariantId);
          if (variant === undefined) {
            variant = await transaction.productVariant.findUnique({
              where: { id: line.productVariantId },
              include: {
                product: { select: { nameFr: true } },
                balances: { include: { location: { select: { id: true, name: true, isActive: true } } } },
              },
            });
            variantCache.set(line.productVariantId, variant);
          }
          if (!variant || !variant.isActive || variant.unitPrice <= 0) throw new Error("VARIANT_UNAVAILABLE");
          const description = `${variant.product.nameFr} · ${[variant.color, variant.size].filter(Boolean).join(" / ")}`;
          normalizedLines.push({
            description,
            quantity: line.quantity,
            unitPrice: variant.unitPrice,
            total: Math.round(line.quantity * variant.unitPrice),
            category: line.category,
            productVariantId: variant.id,
          });
          demandByVariant.set(line.productVariantId, (demandByVariant.get(line.productVariantId) ?? 0) + line.quantity);
        } else if (line.serviceId) {
          let service = serviceCache.get(line.serviceId);
          if (service === undefined) {
            service = await transaction.service.findUnique({ where: { id: line.serviceId } });
            serviceCache.set(line.serviceId, service);
          }
          if (!service || !service.isActive || !service.unitPrice || service.unitPrice <= 0) throw new Error("SERVICE_UNAVAILABLE");
          normalizedLines.push({
            description: `${service.titleFr} · ${service.billingUnit ?? "prestation"}`,
            quantity: line.quantity,
            unitPrice: service.unitPrice,
            total: Math.round(line.quantity * service.unitPrice),
            category: service.salesCategory,
            serviceId: service.id,
          });
        } else {
          normalizedLines.push({
            description: line.description!,
            quantity: line.quantity,
            unitPrice: line.unitPrice!,
            total: Math.round(line.quantity * line.unitPrice!),
            category: line.category,
          });
        }
      }
      const subtotal = normalizedLines.reduce((sum, line) => sum + line.total, 0);
      if (subtotal <= 0) throw new Error("ORDER_TOTAL_INVALID");
      const discountLimit = Math.floor(subtotal * (staff.role === "ADMIN" ? 1 : staff.maxDiscountPercent / 100));
      if (parsed.data.discountAmount > discountLimit || parsed.data.discountAmount > subtotal) {
        throw new Error("DISCOUNT_LIMIT_EXCEEDED");
      }

      const variantBalances = new Map<string, { balanceId: string; locationId: string; variant: SaleVariant }>();
      for (const [variantId, demand] of demandByVariant) {
        const variant = variantCache.get(variantId);
        if (!variant || variant === null) throw new Error("VARIANT_UNAVAILABLE");
        const balance = variant.balances.find((entry) => entry.location.isActive
          && entry.quantityOnHand.minus(entry.quantityReserved).greaterThanOrEqualTo(demand.toFixed(3)));
        if (!balance || variant.quantityOnHand.minus(variant.quantityReserved).lessThan(demand.toFixed(3))) {
          throw new Error("INSUFFICIENT_VARIANT_STOCK");
        }
        variantBalances.set(variantId, { balanceId: balance.id, locationId: balance.locationId, variant });
      }

      if (parsed.data.quoteRequestId) {
        const quote = await transaction.quoteRequest.findUnique({
          where: { id: parsed.data.quoteRequestId },
          select: { status: true, order: { select: { id: true } } },
        });
        if (!quote || quote.status !== "ACCEPTED" || quote.order) throw new Error("QUOTE_NOT_CONVERTIBLE");
      }
      const created = await transaction.customerOrder.create({
        data: {
          orderNumber: newNumber("CMD"),
          invoiceNumber: newNumber("FAC"),
          requestKey: parsed.data.requestKey,
          quoteRequestId: parsed.data.quoteRequestId,
          customerName: parsed.data.customerName,
          customerEmail: parsed.data.customerEmail || null,
          customerPhone: parsed.data.customerPhone || null,
          category: parsed.data.category,
          subtotal,
          discountAmount: parsed.data.discountAmount,
          totalAmount: subtotal - parsed.data.discountAmount,
          notes: parsed.data.notes || null,
          createdByUserId: staff.userId!,
          lines: {
            create: normalizedLines.map((line) => line.productVariantId
              ? {
                ...line,
                stockLocationId: variantBalances.get(line.productVariantId)!.locationId,
                stockReservedAt: new Date(),
              }
              : line),
          },
        },
        include: { lines: true },
      });
      for (const [variantId, demand] of demandByVariant) {
        const { balanceId, locationId, variant } = variantBalances.get(variantId)!;
        await transaction.productVariant.update({
          where: { id: variantId },
          data: { quantityReserved: variant.quantityReserved.plus(demand.toFixed(3)) },
        });
        await transaction.productVariantBalance.update({
          where: { id: balanceId },
          data: { quantityReserved: { increment: demand } },
        });
        const relatedLines = created.lines.filter((line) => line.productVariantId === variantId);
        for (const line of relatedLines) {
          const movement = await transaction.stockMovement.create({
            data: {
              productVariantId: variantId,
              locationId,
              actorId: staff.userId!,
              orderId: created.id,
              type: "RESERVATION",
              quantity: line.quantity.toString(),
              reason: `Réservation liée à la commande ${created.orderNumber}`,
              reference: created.invoiceNumber,
            },
          });
          await transaction.auditEvent.create({
            data: {
              actorId: staff.userId!,
              action: "STOCK_VARIANT_RESERVATION",
              targetType: "ProductVariant",
              targetId: variantId,
              result: "SUCCESS",
              reason: movement.reason,
              details: { movementId: movement.id, orderId: created.id, quantity: line.quantity.toString(), locationId },
            },
          });
        }
      }
      await transaction.auditEvent.create({
        data: {
          actorId: staff.userId!,
          action: "ORDER_CREATED",
          targetType: "CustomerOrder",
          targetId: created.id,
          result: "SUCCESS",
          details: {
            orderNumber: created.orderNumber,
            totalAmount: created.totalAmount,
            quoteRequestId: created.quoteRequestId,
          },
        },
      });
      return created;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ order }, { status: 201 });
  } catch (failure) {
    if (typeof failure === "object" && failure !== null && "code" in failure && failure.code === "P2002") {
      const existing = await prisma.customerOrder.findUnique({
        where: { requestKey: parsed.data.requestKey },
        include: { lines: true },
      });
      if (existing && existing.createdByUserId === staff.userId) {
        return NextResponse.json({ order: existing, alreadyCreated: true });
      }
    }
    if (failure instanceof Error && failure.message === "QUOTE_NOT_CONVERTIBLE") {
      return NextResponse.json({ error: "Seul un devis accepté, non encore converti, peut créer cette commande." }, { status: 409 });
    }
    if (failure instanceof Error) {
      if (failure.message === "VARIANT_UNAVAILABLE") return NextResponse.json({ error: "Une variante sélectionnée est inactive, introuvable ou sans tarif configuré." }, { status: 409 });
      if (failure.message === "SERVICE_UNAVAILABLE") return NextResponse.json({ error: "Un service sélectionné est inactif, introuvable ou sans tarif configuré." }, { status: 409 });
      if (failure.message === "INSUFFICIENT_VARIANT_STOCK") return NextResponse.json({ error: "Stock disponible insuffisant pour une des variantes sélectionnées." }, { status: 409 });
      if (failure.message === "DISCOUNT_LIMIT_EXCEEDED") return NextResponse.json({ error: `La remise dépasse ton plafond autorisé (${staff.role === "ADMIN" ? 100 : staff.maxDiscountPercent} %).` }, { status: 403 });
      if (failure.message === "ORDER_TOTAL_INVALID") return NextResponse.json({ error: "Le total de la commande doit être supérieur à zéro." }, { status: 400 });
    }
    console.error("Order POST:", failure);
    return NextResponse.json({ error: "Impossible de créer la commande." }, { status: 500 });
  }
}
