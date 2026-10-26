import "server-only";

import type { ExpensePaymentMethod, ExpenseStatus, Prisma } from "@prisma/client";
import { getMonthBounds, todayInBenin, toValidDate } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";

export type ExpenseReportFilters = {
  year: number;
  month: number;
  currency: string;
  categoryId?: string;
  status?: string;
  method?: ExpensePaymentMethod;
  beneficiary?: string;
  userId?: string;
  english: boolean;
};

export async function buildExpenseReport(filters: ExpenseReportFilters) {
  const { start, end } = getMonthBounds(filters.year, filters.month);
  const previous = getMonthBounds(filters.month === 1 ? filters.year - 1 : filters.year, filters.month === 1 ? 12 : filters.month - 1);
  const common: Prisma.ExpenseWhereInput = {
    currency: filters.currency,
    status: { not: "CANCELLED" },
    ...(filters.userId ? { createdById: filters.userId } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.beneficiary ? { beneficiary: { contains: filters.beneficiary, mode: "insensitive" } } : {}),
    ...(filters.method ? { payments: { some: { isVoided: false, method: filters.method } } } : {}),
  };
  const statusInput = filters.status ?? "ALL";
  const today = toValidDate(todayInBenin())!;
  const invoiceWhere: Prisma.ExpenseWhereInput = {
    ...common,
    OR: [
      { periodStart: { gte: start, lt: end } },
      { periodStart: null, expenseDate: { gte: start, lt: end } },
    ],
    ...(statusInput === "OVERDUE"
      ? { status: { in: ["UNPAID", "PARTIALLY_PAID"] as ExpenseStatus[] }, dueDate: { lt: today } }
      : statusInput !== "ALL" ? { status: statusInput as ExpenseStatus } : {}),
  };
  const recordedWhere: Prisma.ExpenseWhereInput = {
    ...common,
    createdAt: { gte: start, lt: end },
    ...(statusInput === "OVERDUE"
      ? { status: { in: ["UNPAID", "PARTIALLY_PAID"] as ExpenseStatus[] }, dueDate: { lt: today } }
      : statusInput !== "ALL" ? { status: statusInput as ExpenseStatus } : {}),
  };
  const paymentScope: Prisma.ExpenseWhereInput = {
    currency: filters.currency,
    status: { not: "CANCELLED" },
    ...(filters.userId ? { createdById: filters.userId } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.beneficiary ? { beneficiary: { contains: filters.beneficiary, mode: "insensitive" } } : {}),
  };
  const [expenses, recordedCount, paymentsThisMonth, paymentsPreviousMonth, categories] = await Promise.all([
    prisma.expense.findMany({
      where: invoiceWhere,
      include: {
        category: { select: { nameFr: true, nameEn: true } },
        createdBy: { select: { fullName: true } },
        payments: {
          where: { isVoided: false },
          include: { createdBy: { select: { fullName: true } } },
          orderBy: { paidAt: "asc" },
        },
      },
      orderBy: [{ expenseDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.expense.count({ where: recordedWhere }),
    prisma.expensePayment.findMany({
      where: {
        isVoided: false,
        paidAt: { gte: start, lt: end },
        ...(filters.method ? { method: filters.method } : {}),
        expense: paymentScope,
      },
      include: { expense: { select: { isDeposit: true } } },
    }),
    prisma.expensePayment.findMany({
      where: {
        isVoided: false,
        paidAt: { gte: previous.start, lt: previous.end },
        ...(filters.method ? { method: filters.method } : {}),
        expense: paymentScope,
      },
      include: { expense: { select: { isDeposit: true } } },
    }),
    prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { nameFr: "asc" }],
      select: { id: true, nameFr: true, nameEn: true },
    }),
  ]);
  const rows = expenses.map((expense) => {
    const paidAmount = expense.payments.reduce((sum, payment) => sum + payment.amount, 0);
    return {
      ...expense,
      categoryName: filters.english ? expense.category.nameEn : expense.category.nameFr,
      paidAmount,
      remainingAmount: Math.max(0, expense.amount - paidAmount),
      paymentMethods: [...new Set(expense.payments.map((payment) => payment.method))],
      computedStatus: expense.status === "CANCELLED" ? "CANCELLED"
        : paidAmount >= expense.amount ? "PAID"
          : expense.dueDate && expense.dueDate < today ? "OVERDUE"
            : paidAmount > 0 ? "PARTIALLY_PAID" : "UNPAID",
    };
  });
  const chargeRows = rows.filter((expense) => !expense.isDeposit);
  const activeChargeRows = chargeRows.filter((expense) => expense.status !== "CANCELLED");
  const categoryTotals = new Map<string, { categoryId: string; categoryName: string; amount: number }>();
  for (const expense of activeChargeRows) {
    const entry = categoryTotals.get(expense.categoryId) ?? {
      categoryId: expense.categoryId,
      categoryName: expense.categoryName,
      amount: 0,
    };
    entry.amount += expense.amount;
    categoryTotals.set(expense.categoryId, entry);
  }
  const methodTotals = new Map<string, number>();
  for (const payment of paymentsThisMonth) {
    if (payment.expense.isDeposit) continue;
    methodTotals.set(payment.method, (methodTotals.get(payment.method) ?? 0) + payment.amount);
  }
  return {
    year: filters.year,
    month: filters.month,
    currency: filters.currency,
    generatedAt: new Date(),
    recordedCount,
    invoiceCount: chargeRows.length,
    totalInvoiced: activeChargeRows.reduce((sum, expense) => sum + expense.amount, 0),
    totalPaidThisMonth: paymentsThisMonth.reduce(
      (sum, payment) => sum + (payment.expense.isDeposit ? 0 : payment.amount),
      0,
    ),
    depositPaymentsThisMonth: paymentsThisMonth.reduce(
      (sum, payment) => sum + (payment.expense.isDeposit ? payment.amount : 0),
      0,
    ),
    outstanding: activeChargeRows.reduce((sum, expense) => sum + expense.remainingAmount, 0),
    partialCount: activeChargeRows.filter((expense) => expense.computedStatus === "PARTIALLY_PAID").length,
    overdue: activeChargeRows.filter((expense) => expense.remainingAmount > 0 && expense.dueDate && expense.dueDate < today)
      .reduce((sum, expense) => sum + expense.remainingAmount, 0),
    previousMonthPaid: paymentsPreviousMonth.reduce((sum, payment) =>
      sum + (payment.expense.isDeposit ? 0 : payment.amount), 0),
    categoryTotals: [...categoryTotals.values()].sort((a, b) => b.amount - a.amount),
    methodTotals: [...methodTotals.entries()].map(([method, amount]) => ({ method, amount })),
    expenses: rows,
    categories,
    filters: {
      categoryId: filters.categoryId ?? "",
      status: filters.status ?? "ALL",
      method: filters.method ?? "",
      beneficiary: filters.beneficiary ?? "",
    },
  };
}
