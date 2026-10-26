import { NextRequest, NextResponse } from "next/server";
import { ExpenseFrequency } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireStaff } from "@/lib/admin-api";
import { MAX_EXPENSE_AMOUNT, parseCategoryDetails } from "@/lib/expense-validation";
import { isExpenseManager, toValidDate } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };
const scheduleSchema = z.object({
  categoryId: z.string().min(1).max(100),
  label: z.string().trim().min(2).max(180),
  beneficiary: z.string().trim().min(2).max(180),
  frequency: z.nativeEnum(ExpenseFrequency),
  customFrequencyDays: z.number().int().min(1).max(3650).optional(),
  nextDueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  estimatedAmount: z.number().int().positive().max(MAX_EXPENSE_AMOUNT).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  reminderDays: z.number().int().min(0).max(365),
  details: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean(),
}).strict().refine(
  (value) => value.frequency !== "CUSTOM" || value.customFrequencyDays !== undefined,
  { message: "La fréquence personnalisée doit être indiquée.", path: ["customFrequencyDays"] },
);

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  const { id } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = scheduleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Les informations de l’échéance sont invalides." }, { status: 400 });
  const nextDueAt = toValidDate(parsed.data.nextDueAt);
  if (!nextDueAt) return NextResponse.json({ error: "La date de la prochaine échéance est invalide." }, { status: 400 });
  try {
    const [schedule, category] = await Promise.all([
      prisma.expenseSchedule.findUnique({ where: { id } }),
      prisma.expenseCategory.findFirst({ where: { id: parsed.data.categoryId, isActive: true }, select: { id: true, slug: true } }),
    ]);
    if (!schedule) return NextResponse.json({ error: "Échéance récurrente introuvable." }, { status: 404 });
    if (!isExpenseManager(staff.role) && schedule.createdById !== staff.userId) {
      return NextResponse.json({ error: "Tu ne peux modifier que les échéances que tu as créées." }, { status: 403 });
    }
    if (!category) return NextResponse.json({ error: "La catégorie choisie n’est pas disponible." }, { status: 400 });
    const detailsResult = parseCategoryDetails(category.slug, parsed.data.details);
    if (!detailsResult.success) return NextResponse.json({ error: "Les détails de cette échéance sont invalides." }, { status: 400 });
    const updated = await prisma.$transaction(async (transaction) => {
      const result = await transaction.expenseSchedule.update({
        where: { id },
        data: { ...parsed.data, nextDueAt, details: detailsResult.data as Prisma.InputJsonValue },
      });
      await transaction.auditEvent.create({
        data: {
          actorId: staff.userId,
          action: "EXPENSE_SCHEDULE_UPDATED",
          targetType: "ExpenseSchedule",
          targetId: id,
          result: "SUCCESS",
          details: {
            before: { categoryId: schedule.categoryId, frequency: schedule.frequency, nextDueAt: schedule.nextDueAt.toISOString(), isActive: schedule.isActive },
            after: { categoryId: result.categoryId, frequency: result.frequency, nextDueAt: result.nextDueAt.toISOString(), isActive: result.isActive },
          },
        },
      });
      return result;
    });
    return NextResponse.json({ schedule: updated });
  } catch (failure) {
    console.error("Expense schedule PATCH:", failure);
    return NextResponse.json({ error: "Impossible de modifier l’échéance récurrente." }, { status: 500 });
  }
}
