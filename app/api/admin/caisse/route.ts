import { NextRequest, NextResponse } from "next/server";
import type { SalesCategory } from "@prisma/client";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/admin-api";
import { getStaffSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { calculateCashBalance } from "@/lib/cash-ledger";
import { parseAdminPagination } from "@/lib/admin-pagination";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  code: z.string().trim().min(2).max(24).regex(/^[A-Za-z0-9-]+$/),
});

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export async function GET(request: NextRequest) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;

  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfDay(now);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const cashierId = request.nextUrl.searchParams.get("cashierId");
  const registerId = request.nextUrl.searchParams.get("registerId");
  const method = request.nextUrl.searchParams.get("method");
  const type = request.nextUrl.searchParams.get("type");
  const category = request.nextUrl.searchParams.get("category");
  const orderId = request.nextUrl.searchParams.get("orderId");
  const pagination = parseAdminPagination(request.nextUrl.searchParams);
  const sessionPagination = parseAdminPagination(new URLSearchParams({
    page: request.nextUrl.searchParams.get("sessionPage") ?? "1",
    pageSize: request.nextUrl.searchParams.get("sessionPageSize") ?? "25",
  }));
  if (!pagination.success || !sessionPagination.success) {
    return NextResponse.json({ error: "Les paramètres de pagination sont invalides." }, { status: 400 });
  }
  const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : null;
  const toDate = to ? new Date(`${to}T00:00:00.000Z`) : null;
  if (
    (fromDate && (Number.isNaN(fromDate.getTime()) || fromDate.toISOString().slice(0, 10) !== from))
    || (toDate && (Number.isNaN(toDate.getTime()) || toDate.toISOString().slice(0, 10) !== to))
    || (fromDate && toDate && fromDate > toDate)
  ) {
    return NextResponse.json({ error: "La période sélectionnée est invalide." }, { status: 400 });
  }
  if (category && !["GRAPHIC_DESIGN", "PRINTING", "ADVERTISING", "OTHER"].includes(category)) {
    return NextResponse.json({ error: "La catégorie de vente sélectionnée est invalide." }, { status: 400 });
  }
  const toExclusive = toDate ? new Date(toDate.getTime() + 24 * 60 * 60 * 1000) : null;
  const cashierSessionIds = staff.role !== "ADMIN"
    ? (await prisma.cashSession.findMany({
      where: { activeUserId: staff.userId },
      select: { id: true },
    })).map((session) => session.id)
    : [];
  const where = {
    ...(staff.role !== "ADMIN" ? { actorId: staff.userId! } : cashierId ? { actorId: cashierId } : {}),
    ...(registerId ? { registerId } : {}),
    ...(method && ["CASH", "MOBILE_MONEY", "BANK_TRANSFER"].includes(method) ? { method: method as "CASH" | "MOBILE_MONEY" | "BANK_TRANSFER" } : {}),
    ...(type && ["PAYMENT", "EXPENSE", "REFUND", "TRANSFER_IN", "TRANSFER_OUT", "REVERSAL", "ADJUSTMENT"].includes(type) ? { type: type as "PAYMENT" | "EXPENSE" | "REFUND" | "TRANSFER_IN" | "TRANSFER_OUT" | "REVERSAL" | "ADJUSTMENT" } : {}),
    ...(category ? {
      OR: [
        { order: { is: { category: category as SalesCategory } } },
        { salesCategory: category as SalesCategory },
      ],
    } : {}),
    ...(orderId ? { orderId } : {}),
    occurredAt: {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toExclusive ? { lt: toExclusive } : {}),
    },
  };

  try {
    const totalOperations = await prisma.cashOperation.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalOperations / pagination.data.pageSize));
    const page = Math.min(pagination.data.page, totalPages);
    const sessionHistoryWhere = staff.role !== "ADMIN" ? { openedByUserId: staff.userId } : {};
    const totalSessions = await prisma.cashSession.count({ where: sessionHistoryWhere });
    const totalSessionPages = Math.max(1, Math.ceil(totalSessions / sessionPagination.data.pageSize));
    const sessionPage = Math.min(sessionPagination.data.page, totalSessionPages);
    const canReviewRequests = staff.role === "ADMIN" || staff.canApproveExpenses || staff.canApproveRefunds;
    const [registers, sessions, sessionHistory, operations, staffUsers, transfers, pendingApprovals, transferTargets] = await Promise.all([
      prisma.cashRegister.findMany({ where: { isActive: true }, orderBy: [{ name: "asc" }] }),
      prisma.cashSession.findMany({
        where: staff.role !== "ADMIN" ? { activeUserId: staff.userId } : { status: "OPEN" },
        include: { register: true, openedBy: { select: { id: true, fullName: true, email: true } } },
        orderBy: [{ openedAt: "desc" }],
      }),
      prisma.cashSession.findMany({
        where: sessionHistoryWhere,
        include: { register: true, openedBy: { select: { id: true, fullName: true } } },
        orderBy: [{ openedAt: "desc" }],
        skip: (sessionPage - 1) * sessionPagination.data.pageSize,
        take: sessionPagination.data.pageSize,
      }),
      prisma.cashOperation.findMany({
        where,
        include: {
          actor: { select: { id: true, fullName: true } },
          register: { select: { id: true, name: true } },
          order: {
            select: {
              id: true,
              orderNumber: true,
              invoiceNumber: true,
              lines: { select: { description: true, quantity: true, unitPrice: true, total: true } },
            },
          },
        },
        orderBy: [{ occurredAt: "desc" }],
        skip: (page - 1) * pagination.data.pageSize,
        take: pagination.data.pageSize,
      }),
      staff.role === "ADMIN"
        ? prisma.staffUser.findMany({ where: { isActive: true }, select: { id: true, fullName: true } })
        : Promise.resolve([]),
      prisma.cashTransfer.findMany({
        where: staff.role === "ADMIN"
          ? { status: "REQUESTED" }
          : { OR: [{ initiatedByUserId: staff.userId! }, { destinationSessionId: { in: cashierSessionIds } }] },
        orderBy: [{ createdAt: "desc" }],
        take: 50,
      }),
      canReviewRequests
        ? prisma.cashOperation.findMany({
          where: {
            approvalStatus: "REQUESTED",
            ...(staff.role !== "ADMIN" ? { actorId: { not: staff.userId! } } : {}),
            ...(staff.role !== "ADMIN" && !staff.canApproveExpenses ? { type: { in: ["REFUND", "REVERSAL"] } } : {}),
            ...(staff.role !== "ADMIN" && !staff.canApproveRefunds ? { type: "EXPENSE" } : {}),
          },
          include: {
            actor: { select: { id: true, fullName: true } },
            register: { select: { id: true, name: true } },
            order: { select: { id: true, orderNumber: true, invoiceNumber: true } },
          },
          orderBy: [{ occurredAt: "asc" }],
          take: 100,
        })
        : Promise.resolve([]),
      staff.role !== "ADMIN"
        ? prisma.cashSession.findMany({
          where: { status: "OPEN" },
          select: {
            id: true,
            register: { select: { id: true, name: true } },
            openedBy: { select: { id: true, fullName: true } },
          },
        })
        : Promise.resolve([]),
    ]);
    const summarize = async (since: Date) => {
      const groups = await prisma.cashOperation.groupBy({
        by: ["type"],
        where: {
          ...(staff.role !== "ADMIN" ? { actorId: staff.userId! } : {}),
          occurredAt: { gte: since },
          approvalStatus: { in: ["APPROVED", "NOT_REQUIRED"] },
        },
        _sum: { amount: true },
      });
      const amount = (operationType: string) => groups.find((group) => group.type === operationType)?._sum.amount ?? 0;
      const payments = amount("PAYMENT");
      const refunds = amount("REFUND") + amount("REVERSAL");
      return { revenue: payments - refunds, expenses: amount("EXPENSE"), payments, refunds };
    };
    const sessionsWithExpected = await Promise.all(sessions.map(async (session) => {
      const allOperations = await prisma.cashOperation.findMany({
        where: { sessionId: session.id, approvalStatus: { in: ["APPROVED", "NOT_REQUIRED"] } },
        select: { type: true, amount: true, method: true, orderId: true, reversalOf: { select: { type: true } } },
      });
      const expected = calculateCashBalance(session.openingFloat, allOperations.filter((operation) => operation.method === "CASH"));
      const paidOrderIds = new Set<string>();
      const closingSummary = allOperations.reduce((summary, operation) => {
        if (operation.type === "PAYMENT") summary.payments += operation.amount;
        if (operation.type === "PAYMENT" && operation.orderId) paidOrderIds.add(operation.orderId);
        if (operation.type === "PAYMENT" && !operation.orderId) summary.salesCount += 1;
        if (operation.type === "EXPENSE") summary.expenses += operation.amount;
        if (operation.type === "REFUND" || operation.type === "REVERSAL") summary.refunds += operation.amount;
        return summary;
      }, { payments: 0, salesCount: 0, expenses: 0, refunds: 0 });
      closingSummary.salesCount += paidOrderIds.size;
      return { ...session, expectedBalance: expected, closingSummary };
    }));
    const [summaryDay, summaryWeek, summaryMonth, cashierGroups, methodGroups, categoryOperations] = await Promise.all([
      summarize(todayStart),
      summarize(weekStart),
      summarize(monthStart),
      prisma.cashOperation.groupBy({
        by: ["actorId"],
        where: { ...where, type: "PAYMENT", approvalStatus: { in: ["APPROVED", "NOT_REQUIRED"] } },
        _sum: { amount: true },
      }),
      prisma.cashOperation.groupBy({
        by: ["method"],
        where: { ...where, type: "PAYMENT", approvalStatus: { in: ["APPROVED", "NOT_REQUIRED"] } },
        _sum: { amount: true },
      }),
      prisma.cashOperation.groupBy({
        by: ["orderId", "salesCategory", "type"],
        where: { ...where, orderId: { not: null }, type: { in: ["PAYMENT", "REFUND", "REVERSAL"] }, approvalStatus: { in: ["APPROVED", "NOT_REQUIRED"] } },
        _sum: { amount: true },
      }),
    ]);
    const actorIds = cashierGroups.map((group) => group.actorId);
    const actors = await prisma.staffUser.findMany({ where: { id: { in: actorIds } }, select: { id: true, fullName: true } });
    const actorNames = new Map(actors.map((actor) => [actor.id, actor.fullName]));
    const orderIds = categoryOperations.flatMap((group) => group.orderId ? [group.orderId] : []);
    const orderCategories = await prisma.customerOrder.findMany({ where: { id: { in: orderIds } }, select: { id: true, category: true } });
    const categoryNames = new Map(orderCategories.map((order) => [order.id, order.category]));
    const salesByCategory = new Map<string, number>();
    for (const group of categoryOperations) {
      const sign = group.type === "PAYMENT" ? 1 : -1;
      const category = group.orderId
        ? categoryNames.get(group.orderId) ?? "OTHER"
        : group.salesCategory ?? "OTHER";
      salesByCategory.set(category, (salesByCategory.get(category) ?? 0) + sign * (group._sum.amount ?? 0));
    }

    return NextResponse.json({
      registers,
      sessions: sessionsWithExpected,
      sessionHistory,
      operations,
      pagination: { page, pageSize: pagination.data.pageSize, total: totalOperations, totalPages },
      sessionPagination: { page: sessionPage, pageSize: sessionPagination.data.pageSize, total: totalSessions, totalPages: totalSessionPages },
      staffUsers,
      currentUser: {
        id: staff.userId,
        role: staff.role,
        canApproveExpenses: staff.canApproveExpenses,
        canApproveRefunds: staff.canApproveRefunds,
        canExportReports: staff.canExportReports,
      },
      transfers,
      pendingApprovals,
      transferTargets,
      summaries: { day: summaryDay, week: summaryWeek, month: summaryMonth },
      cashierTotals: cashierGroups.map((group) => ({
        cashierId: group.actorId,
        cashierName: actorNames.get(group.actorId) ?? "Compte désactivé",
        total: group._sum.amount ?? 0,
      })),
      methodTotals: methodGroups.map((group) => ({ method: group.method, total: group._sum.amount ?? 0 })),
      salesByCategory: [...salesByCategory.entries()].map(([category, total]) => ({ category, total })),
    });
  } catch (failure) {
    console.error("Cash dashboard GET:", failure);
    return NextResponse.json({ error: "Impossible de charger le tableau de caisse." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;
  const actor = await getStaffSession();
  if (!actor?.userId) return NextResponse.json({ error: "Reconnecte-toi avant de créer une caisse." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Nom ou code de caisse invalide." }, { status: 400 });

  try {
    const register = await prisma.$transaction(async (transaction) => {
      const created = await transaction.cashRegister.create({
        data: { name: parsed.data.name, code: parsed.data.code.toUpperCase() },
      });
      await transaction.auditEvent.create({
        data: {
          actorId: actor.userId!,
          action: "CASH_REGISTER_CREATED",
          targetType: "CashRegister",
          targetId: created.id,
          result: "SUCCESS",
          details: { code: created.code },
        },
      });
      return created;
    });
    return NextResponse.json({ register }, { status: 201 });
  } catch (failure) {
    if (typeof failure === "object" && failure !== null && "code" in failure && failure.code === "P2002") {
      return NextResponse.json({ error: "Ce code de caisse est déjà utilisé." }, { status: 409 });
    }
    console.error("Cash register POST:", failure);
    return NextResponse.json({ error: "Impossible de créer la caisse." }, { status: 500 });
  }
}
