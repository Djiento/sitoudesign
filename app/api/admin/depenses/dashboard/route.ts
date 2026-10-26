import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-api";
import { getMonthBounds, ownerFilter, todayInBenin, toValidDate } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";

function parseMonth(value: string | null) {
  if (!value) {
    const [year, month] = todayInBenin().split("-").map(Number);
    return { year, month };
  }
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null;
}

export async function GET(request: NextRequest) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  const selected = parseMonth(request.nextUrl.searchParams.get("month"));
  if (!selected) return NextResponse.json({ error: "Le mois sélectionné est invalide." }, { status: 400 });
  const currency = request.nextUrl.searchParams.get("currency") || "XOF";
  if (!/^[A-Z]{3}$/.test(currency)) return NextResponse.json({ error: "La devise sélectionnée est invalide." }, { status: 400 });
  const english = request.nextUrl.searchParams.get("locale") === "en";
  const { start, end } = getMonthBounds(selected.year, selected.month);
  const previous = getMonthBounds(selected.month === 1 ? selected.year - 1 : selected.year, selected.month === 1 ? 12 : selected.month - 1);
  const scope = ownerFilter(staff.userId, staff.role !== "CASHIER");
  const now = toValidDate(todayInBenin())!;
  const sixMonthsAgo = new Date(Date.UTC(selected.year, selected.month - 5, 1));

  try {
    const [
      monthExpenses,
      monthPayments,
      priorPayments,
      openExpenses,
      overdueExpenses,
      categoryExpenses,
      costlyExpenses,
      latestExpenses,
      upcomingExpenses,
      schedules,
      trendPayments,
    ] = await Promise.all([
      prisma.expense.findMany({
        where: { ...scope, currency, createdAt: { gte: start, lt: end } },
        select: { id: true, isDeposit: true },
      }),
      prisma.expensePayment.findMany({
        where: { isVoided: false, paidAt: { gte: start, lt: end }, expense: { isDeposit: false, currency, status: { not: "CANCELLED" }, ...scope } },
        select: { amount: true },
      }),
      prisma.expensePayment.findMany({
        where: { isVoided: false, paidAt: { gte: previous.start, lt: previous.end }, expense: { isDeposit: false, currency, status: { not: "CANCELLED" }, ...scope } },
        select: { amount: true },
      }),
      prisma.expense.findMany({
        where: { ...scope, currency, isDeposit: false, status: { in: ["UNPAID", "PARTIALLY_PAID"] } },
        include: { payments: { where: { isVoided: false }, select: { amount: true } } },
      }),
      prisma.expense.findMany({
        where: { ...scope, currency, isDeposit: false, status: { in: ["UNPAID", "PARTIALLY_PAID"] }, dueDate: { lt: now } },
        include: { payments: { where: { isVoided: false }, select: { amount: true } } },
      }),
      prisma.expense.findMany({
        where: {
          ...scope,
          currency,
          isDeposit: false,
          status: { not: "CANCELLED" },
          OR: [
            { periodStart: { gte: start, lt: end } },
            { periodStart: null, expenseDate: { gte: start, lt: end } },
          ],
        },
        include: { category: { select: { nameFr: true, nameEn: true } } },
      }),
      prisma.expense.findMany({
        where: { ...scope, currency, isDeposit: false, status: { not: "CANCELLED" } },
        orderBy: { amount: "desc" },
        take: 5,
        include: { category: { select: { nameFr: true, nameEn: true } } },
      }),
      prisma.expense.findMany({
        where: { ...scope, currency },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { category: { select: { nameFr: true, nameEn: true } } },
      }),
      prisma.expense.findMany({
        where: {
          ...scope,
          currency,
          isDeposit: false,
          status: { in: ["UNPAID", "PARTIALLY_PAID"] },
          dueDate: { gte: now },
        },
        orderBy: { dueDate: "asc" },
        take: 5,
        include: { category: { select: { nameFr: true, nameEn: true } }, payments: { where: { isVoided: false }, select: { amount: true } } },
      }),
      prisma.expenseSchedule.findMany({
        where: { ...(staff.role === "CASHIER" ? { createdById: staff.userId } : {}), currency, isActive: true, nextDueAt: { gte: now } },
        orderBy: { nextDueAt: "asc" },
        take: 5,
        include: { category: { select: { nameFr: true, nameEn: true } } },
      }),
      prisma.expensePayment.findMany({
        where: { isVoided: false, paidAt: { gte: sixMonthsAgo, lt: end }, expense: { ...scope, currency, isDeposit: false, status: { not: "CANCELLED" } } },
        select: { amount: true, paidAt: true },
      }),
    ]);
    const remaining = (expense: { amount: number; payments: { amount: number }[] }) =>
      Math.max(0, expense.amount - expense.payments.reduce((sum, payment) => sum + payment.amount, 0));
    const monthInvoiced = categoryExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const categoryTotals = new Map<string, { category: string; amount: number }>();
    for (const expense of categoryExpenses) {
      const category = categoryTotals.get(expense.categoryId) ?? {
        category: english ? expense.category.nameEn : expense.category.nameFr,
        amount: 0,
      };
      category.amount += expense.amount;
      categoryTotals.set(expense.categoryId, category);
    }
    const trend = Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(Date.UTC(selected.year, selected.month - 5 + index, 1));
      const key = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, "0")}`;
      return {
        month: key,
        amount: trendPayments.reduce((sum, payment) =>
          payment.paidAt.toISOString().slice(0, 7) === key ? sum + payment.amount : sum, 0),
      };
    });
    const upcoming = [
      ...upcomingExpenses.map((expense) => ({
        id: expense.id,
        label: expense.label,
        reference: expense.reference,
        date: expense.dueDate ?? now,
        amount: remaining(expense),
        currency: expense.currency,
        kind: "EXPENSE" as const,
        alert: Boolean(expense.dueDate && expense.dueDate.getTime() <= now.getTime() + 7 * 86_400_000),
      })),
      ...schedules.map((schedule) => ({
        id: schedule.id,
        label: schedule.label,
        reference: null,
        date: schedule.nextDueAt,
        amount: schedule.estimatedAmount ?? 0,
        currency: schedule.currency,
        kind: "SCHEDULE" as const,
        alert: schedule.nextDueAt.getTime() <= now.getTime() + schedule.reminderDays * 86_400_000,
      })),
    ].sort((first, second) => first.date.getTime() - second.date.getTime()).slice(0, 8);
    return NextResponse.json({
      month: `${selected.year}-${String(selected.month).padStart(2, "0")}`,
      currency,
      metrics: {
        recordedCount: monthExpenses.length,
        paidThisMonth: monthPayments.reduce((sum, item) => sum + item.amount, 0),
        invoicedThisMonth: monthInvoiced,
        outstanding: openExpenses.reduce((sum, expense) => sum + remaining(expense), 0),
        overdue: overdueExpenses.reduce((sum, expense) => sum + remaining(expense), 0),
        partialCount: openExpenses.filter((expense) => expense.status === "PARTIALLY_PAID").length,
        previousMonthPaid: priorPayments.reduce((sum, item) => sum + item.amount, 0),
        depositsPaidThisMonth: await prisma.expensePayment.aggregate({
          where: { isVoided: false, paidAt: { gte: start, lt: end }, expense: { ...scope, currency, isDeposit: true, status: { not: "CANCELLED" } } },
          _sum: { amount: true },
        }).then((result) => result._sum.amount ?? 0),
      },
      categoryTotals: [...categoryTotals.values()].sort((a, b) => b.amount - a.amount),
      topExpenses: costlyExpenses,
      recentExpenses: latestExpenses,
      upcoming,
      trend,
      depositsExcludedFromCharges: true,
      recordedExcludingDeposits: monthExpenses.filter((expense) => !expense.isDeposit).length,
    });
  } catch (failure) {
    console.error("Expense dashboard GET:", failure);
    return NextResponse.json({ error: "Impossible de charger le tableau de bord financier." }, { status: 500 });
  }
}
