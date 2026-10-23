import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireStaff } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

const periodSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const categorySchema = z.enum(["GRAPHIC_DESIGN", "PRINTING", "ADVERTISING", "OTHER"]);
const reportModules = {
  SALES: ["CustomerOrder", "OrderPayment"],
  CASH: ["CashOperation", "CashSession", "CashRegister"],
  STOCK: ["StockItem", "ProductVariant", "StockMovement", "StockLocation"],
  USERS: ["StaffUser"],
  CONTENT: ["Product", "Service", "Category", "Article", "PortfolioProject", "BusinessSolution"],
} as const;
const moduleSchema = z.enum(["ALL", "SALES", "CASH", "STOCK", "USERS", "CONTENT"]);

function getPeriod(fromValue: string | null, toValue: string | null) {
  const now = new Date();
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const defaultTo = now.toISOString().slice(0, 10);
  const parsed = periodSchema.safeParse({
    from: fromValue || defaultFrom,
    to: toValue || defaultTo,
  });
  if (!parsed.success) return null;

  const start = new Date(`${parsed.data.from}T00:00:00.000Z`);
  const end = new Date(`${parsed.data.to}T00:00:00.000Z`);
  if (
    Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
    || start.toISOString().slice(0, 10) !== parsed.data.from
    || end.toISOString().slice(0, 10) !== parsed.data.to
    || start > end
  ) return null;
  end.setUTCDate(end.getUTCDate() + 1);
  return { from: parsed.data.from, to: parsed.data.to, start, end };
}

async function authorizeReports() {
  const { staff, error } = await requireStaff();
  if (error || !staff) return { staff: null, response: error };
  if (staff.role !== "ADMIN" && !staff.canExportReports) {
    return {
      staff: null,
      response: NextResponse.json({ error: "L’accès aux rapports n’est pas autorisé." }, { status: 403 }),
    };
  }
  return { staff, response: null };
}

export async function GET(request: NextRequest) {
  const { staff, response } = await authorizeReports();
  if (response || !staff) return response;
  const period = getPeriod(
    request.nextUrl.searchParams.get("from"),
    request.nextUrl.searchParams.get("to"),
  );
  if (!period) return NextResponse.json({ error: "La période sélectionnée est invalide." }, { status: 400 });

  const isAdmin = staff.role === "ADMIN";
  const requestedActorId = request.nextUrl.searchParams.get("userId")?.trim() || "";
  if (!isAdmin && requestedActorId && requestedActorId !== staff.userId) {
    return NextResponse.json({ error: "Tu ne peux consulter que tes propres rapports." }, { status: 403 });
  }
  const actorId = isAdmin ? requestedActorId || undefined : staff.userId;
  const requestedCategory = request.nextUrl.searchParams.get("category") || "";
  const parsedCategory = requestedCategory ? categorySchema.safeParse(requestedCategory) : null;
  if (requestedCategory && !parsedCategory?.success) {
    return NextResponse.json({ error: "La catégorie sélectionnée est invalide." }, { status: 400 });
  }
  const requestedModule = request.nextUrl.searchParams.get("module") || "ALL";
  const parsedModule = moduleSchema.safeParse(requestedModule);
  if (!parsedModule.success) return NextResponse.json({ error: "Le module sélectionné est invalide." }, { status: 400 });
  const category = parsedCategory?.success ? parsedCategory.data : undefined;
  const selectedModule = parsedModule.data;
  const operationWhere: Prisma.CashOperationWhereInput = {
    occurredAt: { gte: period.start, lt: period.end },
    approvalStatus: { in: ["APPROVED", "NOT_REQUIRED"] },
    ...(actorId ? { actorId } : {}),
    ...(category ? {
      OR: [
        { order: { is: { category } } },
        { salesCategory: category },
      ],
    } : {}),
  };
  const orderWhere = {
    createdAt: { gte: period.start, lt: period.end },
    status: { not: "CANCELLED" as const },
    ...(actorId ? { createdByUserId: actorId } : {}),
    ...(category ? { category } : {}),
  };
  const sessionWhere = {
    status: "CLOSED" as const,
    closedAt: { gte: period.start, lt: period.end },
    ...(actorId ? { openedByUserId: actorId } : {}),
  };
  const movementWhere = {
    createdAt: { gte: period.start, lt: period.end },
    ...(actorId ? { actorId } : {}),
  };

  try {
    const [
      operations,
      orders,
      closedSessions,
      openSessions,
      stockMovements,
      auditEvents,
      stockItems,
      variants,
      users,
    ] = await Promise.all([
      prisma.cashOperation.findMany({
        where: operationWhere,
        select: {
          id: true, type: true, method: true, amount: true, occurredAt: true, reason: true, expenseCategory: true,
          saleDescription: true, saleCategoryLabel: true, saleQuantity: true, saleUnitPrice: true, salesCategory: true, orderId: true,
          actorId: true, actor: { select: { fullName: true } },
          register: { select: { name: true } },
          order: { select: { orderNumber: true } },
        },
        orderBy: { occurredAt: "desc" },
      }),
      prisma.customerOrder.findMany({
        where: orderWhere,
        select: {
          id: true, orderNumber: true, category: true, totalAmount: true, createdAt: true, customerName: true,
          createdBy: { select: { fullName: true } },
        },
      }),
      prisma.cashSession.findMany({
        where: sessionWhere,
        select: {
          id: true, register: { select: { name: true } }, openedBy: { select: { fullName: true } },
          closedAt: true, variance: true,
        },
        orderBy: { closedAt: "desc" },
      }),
      prisma.cashSession.findMany({
        where: { status: "OPEN", ...(actorId ? { openedByUserId: actorId } : {}) },
        select: {
          id: true,
          openingFloat: true,
          openedAt: true,
          register: { select: { name: true } },
          openedBy: { select: { fullName: true } },
        },
        orderBy: { openedAt: "desc" },
      }),
      prisma.stockMovement.findMany({
        where: movementWhere,
        select: {
          id: true, type: true, quantity: true, reason: true, createdAt: true,
          actor: { select: { fullName: true } },
          item: { select: { sku: true, name: true } },
          productVariant: { select: { sku: true, color: true, size: true, product: { select: { nameFr: true } } } },
          order: { select: { orderNumber: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      prisma.auditEvent.findMany({
        where: {
          occurredAt: { gte: period.start, lt: period.end },
          ...(actorId ? { actorId } : {}),
          ...(selectedModule !== "ALL" ? { targetType: { in: [...reportModules[selectedModule]] } } : {}),
        },
        select: { id: true, action: true, targetType: true, result: true, occurredAt: true, actor: { select: { fullName: true } } },
        orderBy: { occurredAt: "desc" },
        take: 12,
      }),
      prisma.stockItem.findMany({
        where: { isActive: true },
        select: { sku: true, name: true, unit: true, quantityOnHand: true, quantityReserved: true, reorderThreshold: true },
      }),
      prisma.productVariant.findMany({
        where: { isActive: true },
        select: {
          sku: true, color: true, size: true, quantityOnHand: true, quantityReserved: true,
          reorderThreshold: true, product: { select: { nameFr: true } },
        },
      }),
      isAdmin
        ? prisma.staffUser.findMany({
          where: { isActive: true },
          select: { id: true, fullName: true },
          orderBy: { fullName: "asc" },
        })
        : Promise.resolve([]),
    ]);

    const totals = operations.reduce((sum, operation) => {
      if (operation.type === "PAYMENT") sum.payments += operation.amount;
      if (operation.type === "REFUND" || operation.type === "REVERSAL") sum.refunds += operation.amount;
      if (operation.type === "EXPENSE") sum.expenses += operation.amount;
      if (operation.type === "PAYMENT") {
        const method = operation.method ?? "OTHER";
        sum.byPaymentMethod[method] = (sum.byPaymentMethod[method] ?? 0) + operation.amount;
      }
      return sum;
    }, { payments: 0, refunds: 0, expenses: 0, byPaymentMethod: {} as Record<string, number> });

    const salesByCategory = orders.reduce((groups, order) => {
      groups[order.category] = (groups[order.category] ?? 0) + order.totalAmount;
      return groups;
    }, {} as Record<string, number>);
    const counterSales = operations.filter((operation) => operation.type === "PAYMENT" && !operation.orderId && operation.saleDescription);
    const counterSalesTotal = counterSales.reduce((total, operation) => total + operation.amount, 0);
    for (const operation of counterSales) {
      const key = operation.saleCategoryLabel ?? operation.salesCategory ?? "OTHER";
      salesByCategory[key] = (salesByCategory[key] ?? 0) + operation.amount;
    }
    const salesByCashier = new Map<string, { name: string; amount: number; count: number }>();
    for (const order of orders) {
      const entry = salesByCashier.get(order.createdBy.fullName) ?? { name: order.createdBy.fullName, amount: 0, count: 0 };
      entry.amount += order.totalAmount;
      entry.count += 1;
      salesByCashier.set(entry.name, entry);
    }
    for (const operation of counterSales) {
      const name = operation.actor.fullName;
      const entry = salesByCashier.get(name) ?? { name, amount: 0, count: 0 };
      entry.amount += operation.amount;
      entry.count += 1;
      salesByCashier.set(name, entry);
    }
    const expensesByCategory = operations.filter((operation) => operation.type === "EXPENSE")
      .reduce((groups, operation) => {
        const key = operation.expenseCategory ?? "Non catégorisées";
        groups[key] = (groups[key] ?? 0) + operation.amount;
        return groups;
      }, {} as Record<string, number>);
    const dailyActivity = new Map<string, { date: string; sales: number; payments: number; expenses: number }>();
    const getDay = (date: Date) => date.toISOString().slice(0, 10);
    for (const order of orders) {
      const date = getDay(order.createdAt);
      const entry = dailyActivity.get(date) ?? { date, sales: 0, payments: 0, expenses: 0 };
      entry.sales += order.totalAmount;
      dailyActivity.set(date, entry);
    }
    for (const operation of operations) {
      const date = getDay(operation.occurredAt);
      const entry = dailyActivity.get(date) ?? { date, sales: 0, payments: 0, expenses: 0 };
      if (operation.type === "PAYMENT") {
        entry.payments += operation.amount;
        if (!operation.orderId && operation.saleDescription) entry.sales += operation.amount;
      }
      if (operation.type === "EXPENSE") entry.expenses += operation.amount;
      dailyActivity.set(date, entry);
    }
    const lowStockItems = [
      ...stockItems.map((item) => ({
        sku: item.sku,
        name: item.name,
        available: item.quantityOnHand.minus(item.quantityReserved).toNumber(),
        unit: item.unit,
        threshold: item.reorderThreshold.toNumber(),
      })),
      ...variants.map((variant) => ({
        sku: variant.sku,
        name: [variant.product.nameFr, variant.color, variant.size].filter(Boolean).join(" · "),
        available: variant.quantityOnHand.minus(variant.quantityReserved).toNumber(),
        unit: "unité",
        threshold: variant.reorderThreshold.toNumber(),
      })),
    ].filter((item) => item.available <= item.threshold)
      .sort((left, right) => left.available - right.available);

    const lowStock = lowStockItems.slice(0, 20);
    const salesTotal = orders.reduce((total, order) => total + order.totalAmount, 0) + counterSalesTotal;

    return NextResponse.json({
      period: { from: period.from, to: period.to },
      filters: { userId: actorId ?? "", category: category ?? "", module: selectedModule },
      summary: {
        salesCount: orders.length + counterSales.length,
        salesTotal,
        invoicedSalesTotal: orders.reduce((total, order) => total + order.totalAmount, 0),
        counterSalesTotal,
        counterSalesCount: counterSales.length,
        averageSale: orders.length + counterSales.length ? Math.round(salesTotal / (orders.length + counterSales.length)) : 0,
        payments: totals.payments,
        refunds: totals.refunds,
        expenses: totals.expenses,
        netCash: totals.payments - totals.refunds - totals.expenses,
        cashVariance: closedSessions.reduce((total, session) => total + (session.variance ?? 0), 0),
        closedSessionCount: closedSessions.length,
        openSessionCount: openSessions.length,
        stockMovementCount: await prisma.stockMovement.count({ where: movementWhere }),
        lowStockCount: lowStockItems.length,
        outOfStockCount: lowStockItems.filter((item) => item.available <= 0).length,
      },
      salesByCategory,
      salesByCashier: [...salesByCashier.values()].sort((left, right) => right.amount - left.amount),
      expensesByCategory,
      dailyActivity: [...dailyActivity.values()].sort((left, right) => left.date.localeCompare(right.date)).slice(-31),
      orders,
      expenses: operations.filter((operation) => operation.type === "EXPENSE"),
      byPaymentMethod: totals.byPaymentMethod,
      closedSessions,
      openSessions,
      stockMovements,
      auditEvents,
      lowStock,
      users,
    });
  } catch (failure) {
    console.error("Admin reports GET:", failure);
    return NextResponse.json({ error: "Impossible de générer le rapport pour cette période." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { staff, response } = await authorizeReports();
  if (response || !staff) return response;
  const body: unknown = await request.json().catch(() => null);
  const parsed = z.object({
    ...periodSchema.shape,
    userId: z.string().max(120).optional(),
    category: categorySchema.optional().or(z.literal("")),
    module: moduleSchema.optional(),
    reportType: z.enum(["GENERAL", "SALES", "EXPENSES", "CASH", "STOCK", "LOW_STOCK", "USERS"]).optional(),
  }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "La période du rapport est invalide." }, { status: 400 });
  const period = getPeriod(parsed.data.from, parsed.data.to);
  if (!period) return NextResponse.json({ error: "La période du rapport est invalide." }, { status: 400 });
  if (staff.role !== "ADMIN" && parsed.data.userId && parsed.data.userId !== staff.userId) {
    return NextResponse.json({ error: "Tu ne peux exporter que tes propres rapports." }, { status: 403 });
  }

  try {
    await prisma.auditEvent.create({
      data: {
        actorId: staff.userId,
        action: "ADMIN_REPORT_PRINTED",
        targetType: "AdminReport",
        targetId: `${period.from}:${period.to}`,
        result: "SUCCESS",
        details: {
          from: period.from,
          to: period.to,
          userId: parsed.data.userId || null,
          category: parsed.data.category || null,
          module: parsed.data.module || "ALL",
          reportType: parsed.data.reportType || "GENERAL",
        },
      },
    });
    return NextResponse.json({ success: true });
  } catch (failure) {
    console.error("Admin report audit POST:", failure);
    return NextResponse.json({ error: "Impossible de journaliser l’export du rapport." }, { status: 500 });
  }
}
