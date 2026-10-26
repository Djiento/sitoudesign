import { NextRequest, NextResponse } from "next/server";
import { ExpenseFrequency } from "@prisma/client";
import { z } from "zod";
import { requireStaff } from "@/lib/admin-api";
import { MAX_EXPENSE_AMOUNT, parseCategoryDetails } from "@/lib/expense-validation";
import type { Prisma } from "@prisma/client";
import { ensureExpenseCategories, toValidDate } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";

const scheduleSchema = z.object({
  categoryId: z.string().min(1).max(100),
  label: z.string().trim().min(2).max(180),
  beneficiary: z.string().trim().min(2).max(180),
  frequency: z.nativeEnum(ExpenseFrequency),
  customFrequencyDays: z.number().int().min(1).max(3650).optional(),
  nextDueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  estimatedAmount: z.number().int().positive().max(MAX_EXPENSE_AMOUNT).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).default("XOF"),
  reminderDays: z.number().int().min(0).max(365).default(7),
  details: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().default(true),
}).strict().refine(
  (value) => value.frequency !== "CUSTOM" || value.customFrequencyDays !== undefined,
  { message: "La fréquence personnalisée doit être indiquée.", path: ["customFrequencyDays"] },
);

export async function GET() {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  try {
    await ensureExpenseCategories();
    const schedules = await prisma.expenseSchedule.findMany({
      where: staff.role === "CASHIER" ? { createdById: staff.userId } : {},
      include: {
        category: { select: { id: true, slug: true, nameFr: true, nameEn: true } },
        createdBy: { select: { id: true, fullName: true } },
        occurrences: {
          include: { expense: { select: { id: true, reference: true, amount: true, status: true } } },
          orderBy: { dueAt: "desc" },
          take: 6,
        },
      },
      orderBy: [{ isActive: "desc" }, { nextDueAt: "asc" }],
    });
    return NextResponse.json({ schedules });
  } catch (failure) {
    console.error("Expense schedules GET:", failure);
    return NextResponse.json({ error: "Impossible de charger les échéances récurrentes." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  const body: unknown = await request.json().catch(() => null);
  const parsed = scheduleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Vérifie les informations de l’échéance récurrente." }, { status: 400 });
  const nextDueAt = toValidDate(parsed.data.nextDueAt);
  if (!nextDueAt) return NextResponse.json({ error: "La prochaine échéance doit être une date valide." }, { status: 400 });
  try {
    const category = await prisma.expenseCategory.findFirst({
      where: { id: parsed.data.categoryId, isActive: true },
      select: { id: true, slug: true },
    });
    if (!category) return NextResponse.json({ error: "La catégorie sélectionnée n’est pas disponible." }, { status: 400 });
    const detailsResult = parseCategoryDetails(category.slug, parsed.data.details);
    if (!detailsResult.success) return NextResponse.json({ error: "Les détails de cette échéance sont incomplets ou invalides." }, { status: 400 });
    const schedule = await prisma.$transaction(async (transaction) => {
      const created = await transaction.expenseSchedule.create({
        data: {
          ...parsed.data,
          nextDueAt,
          details: detailsResult.data as Prisma.InputJsonValue,
          createdById: staff.userId,
        },
      });
      await transaction.auditEvent.create({
        data: {
          actorId: staff.userId,
          action: "EXPENSE_SCHEDULE_CREATED",
          targetType: "ExpenseSchedule",
          targetId: created.id,
          result: "SUCCESS",
          details: {
            categoryId: created.categoryId,
            frequency: created.frequency,
            nextDueAt: created.nextDueAt.toISOString(),
            estimatedAmount: created.estimatedAmount,
          },
        },
      });
      return created;
    });
    return NextResponse.json({ schedule }, { status: 201 });
  } catch (failure) {
    console.error("Expense schedule POST:", failure);
    return NextResponse.json({ error: "Impossible d’enregistrer l’échéance récurrente." }, { status: 500 });
  }
}
