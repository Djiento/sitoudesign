import "server-only";

import type { ExpenseStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export const DEFAULT_EXPENSE_CATEGORIES = [
  { slug: "rent", nameFr: "Loyer", nameEn: "Rent", sortOrder: 1 },
  { slug: "electricity", nameFr: "Électricité", nameEn: "Electricity", sortOrder: 2 },
  { slug: "water", nameFr: "Eau", nameEn: "Water", sortOrder: 3 },
  { slug: "internet", nameFr: "Internet", nameEn: "Internet", sortOrder: 4 },
  { slug: "software", nameFr: "Abonnements logiciels et services numériques", nameEn: "Software and digital services", sortOrder: 5 },
  { slug: "maintenance", nameFr: "Maintenance", nameEn: "Maintenance", sortOrder: 6 },
  { slug: "other", nameFr: "Autres charges", nameEn: "Other expenses", sortOrder: 7 },
] as const;

export async function ensureExpenseCategories() {
  await Promise.all(DEFAULT_EXPENSE_CATEGORIES.map((category) =>
    prisma.expenseCategory.upsert({
      where: { slug: category.slug },
      create: { ...category, isBuiltin: true },
      update: {},
    }),
  ));
}

export function isExpenseManager(role: string) {
  return role === "ADMIN" || role === "MANAGER";
}

export async function getExpenseAccess() {
  const { staff, error } = await requireStaff();
  if (error || !staff) return { staff: null, response: error };
  return { staff, response: null };
}

export async function getExpenseById(id: string, userId: string, canViewAll: boolean) {
  const expense = await prisma.expense.findUnique({
    where: { id },
    include: {
      category: true,
      createdBy: { select: { id: true, fullName: true } },
      updatedBy: { select: { id: true, fullName: true } },
      payments: {
        include: { createdBy: { select: { id: true, fullName: true } } },
        orderBy: { paidAt: "asc" },
      },
      attachments: {
        include: { uploadedBy: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "asc" },
      },
      scheduledOccurrence: {
        include: { schedule: { select: { id: true, label: true, frequency: true } } },
      },
    },
  });
  if (!expense || (!canViewAll && expense.createdById !== userId)) return null;
  const paidAmount = expense.payments.reduce(
    (total, payment) => total + (payment.isVoided ? 0 : payment.amount),
    0,
  );
  return {
    ...expense,
    paidAmount,
    remainingAmount: Math.max(0, expense.amount - paidAmount),
    status: getExpenseStatus(expense.amount, paidAmount, expense.status),
  };
}

export function getExpenseStatus(amount: number, paid: number, status: ExpenseStatus): ExpenseStatus {
  if (status === "CANCELLED") return "CANCELLED";
  if (paid >= amount) return "PAID";
  return paid > 0 ? "PARTIALLY_PAID" : "UNPAID";
}

export function toValidDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function todayInBenin(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Porto-Novo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function addFrequency(date: Date, frequency: string, customDays?: number | null) {
  const result = new Date(date);
  if (frequency === "MONTHLY") result.setUTCMonth(result.getUTCMonth() + 1);
  else if (frequency === "QUARTERLY") result.setUTCMonth(result.getUTCMonth() + 3);
  else if (frequency === "SEMIANNUAL") result.setUTCMonth(result.getUTCMonth() + 6);
  else if (frequency === "ANNUAL") result.setUTCFullYear(result.getUTCFullYear() + 1);
  else if (frequency === "CUSTOM" && customDays) result.setUTCDate(result.getUTCDate() + customDays);
  else throw new Error("INVALID_SCHEDULE_FREQUENCY");
  return result;
}

export async function createExpenseAudit(
  transaction: Prisma.TransactionClient,
  input: {
    actorId: string;
    action: string;
    targetId: string;
    result: string;
    reason?: string | null;
    details?: Prisma.InputJsonValue;
  },
) {
  await transaction.auditEvent.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      targetType: "Expense",
      targetId: input.targetId,
      result: input.result,
      reason: input.reason ?? null,
      details: input.details,
    },
  });
}

export async function ensureNoDuplicateRent(
  transaction: Prisma.TransactionClient,
  input: { categoryId: string; periodStart: Date; periodEnd: Date; propertyAddress: string; excludeExpenseId?: string },
) {
  const existing = await transaction.expense.findFirst({
    where: {
      categoryId: input.categoryId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      isDeposit: false,
      status: { not: "CANCELLED" },
      ...(input.excludeExpenseId ? { id: { not: input.excludeExpenseId } } : {}),
      details: { path: ["propertyAddress"], equals: input.propertyAddress },
    },
    select: { id: true, reference: true },
  });
  if (existing) throw new Error("DUPLICATE_RENT_PERIOD");
}

export function permissionDenied(message = "Cette opération n’est pas autorisée.") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function ownerFilter(userId: string, canViewAll: boolean): Prisma.ExpenseWhereInput {
  return canViewAll ? {} : { createdById: userId };
}

export function getMonthBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  return { start, end: new Date(Date.UTC(year, month, 1)) };
}
