import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireStaff } from "@/lib/admin-api";
import { MAX_EXPENSE_AMOUNT, paymentMethodSchema, parseCategoryDetails, validateExpenseCategoryFields } from "@/lib/expense-validation";
import { addFrequency, createExpenseAudit, ensureNoDuplicateRent, isExpenseManager, todayInBenin, toValidDate } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };
const occurrenceSchema = z.object({
  dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().int().positive().max(MAX_EXPENSE_AMOUNT),
  description: z.string().trim().min(2).max(4000).optional(),
  invoiceNumber: z.string().trim().max(120).optional().or(z.literal("")),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  details: z.record(z.string(), z.unknown()).optional(),
  initialPayment: z.object({
    amount: z.number().int().positive().max(MAX_EXPENSE_AMOUNT),
    method: paymentMethodSchema,
    paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).strict().optional(),
}).strict();

export async function POST(request: NextRequest, context: RouteContext) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  const { id } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = occurrenceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Vérifie la date, le montant et les informations de l’échéance." }, { status: 400 });
  const dueAt = toValidDate(parsed.data.dueAt);
  const invoiceDate = parsed.data.invoiceDate ? toValidDate(parsed.data.invoiceDate) : null;
  const periodStart = parsed.data.periodStart ? toValidDate(parsed.data.periodStart) : null;
  const periodEnd = parsed.data.periodEnd ? toValidDate(parsed.data.periodEnd) : null;
  const paidAt = parsed.data.initialPayment?.paidAt ? toValidDate(parsed.data.initialPayment.paidAt) : dueAt;
  if (
    !dueAt || (parsed.data.invoiceDate && !invoiceDate) || (parsed.data.periodStart && !periodStart)
    || (parsed.data.periodEnd && !periodEnd) || (parsed.data.initialPayment?.paidAt && !paidAt)
    || (invoiceDate && invoiceDate > dueAt) || (periodStart && periodEnd && periodStart > periodEnd)
    || (paidAt && paidAt < dueAt)
    || (parsed.data.initialPayment && paidAt && paidAt.toISOString().slice(0, 10) > todayInBenin())
  ) return NextResponse.json({ error: "Les dates de cette échéance sont incohérentes." }, { status: 400 });
  if (parsed.data.initialPayment && parsed.data.initialPayment.amount > parsed.data.amount) {
    return NextResponse.json({ error: "Le paiement initial dépasse le montant de la dépense." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const schedule = await transaction.expenseSchedule.findUnique({
        where: { id },
        include: { category: { select: { slug: true } } },
      });
      if (!schedule) throw new Error("SCHEDULE_NOT_FOUND");
      if (!schedule.isActive) throw new Error("SCHEDULE_INACTIVE");
      if (!isExpenseManager(staff.role) && schedule.createdById !== staff.userId) throw new Error("SCHEDULE_FORBIDDEN");
      if (schedule.nextDueAt.toISOString().slice(0, 10) !== parsed.data.dueAt) throw new Error("STALE_OCCURRENCE");
      const existing = await transaction.expenseScheduleOccurrence.findUnique({
        where: { scheduleId_dueAt: { scheduleId: id, dueAt } },
        include: { expense: { select: { id: true, reference: true } } },
      });
      if (existing?.expense) throw new Error("OCCURRENCE_ALREADY_RECORDED");
      const detailsResult = parseCategoryDetails(schedule.category.slug, parsed.data.details ?? schedule.details);
      if (!detailsResult.success) throw new Error("INVALID_CATEGORY_DETAILS");
      const details = detailsResult.data;
      if (validateExpenseCategoryFields(schedule.category.slug, details, {
        invoiceNumber: parsed.data.invoiceNumber,
        invoiceDate,
        periodStart,
        periodEnd,
      })) throw new Error("INVALID_CATEGORY_FIELDS");
      const isPrepaidElectricity = schedule.category.slug === "electricity"
        && "type" in details && details.type === "PREPAID";
      if (isPrepaidElectricity && parsed.data.initialPayment?.amount !== parsed.data.amount) {
        throw new Error("PREPAID_REQUIRES_FULL_PAYMENT");
      }
      const isDeposit = schedule.category.slug === "rent"
        && "paymentType" in details && details.paymentType === "DEPOSIT";
      if (!isDeposit && schedule.category.slug === "rent" && periodStart && periodEnd
        && "propertyAddress" in details && typeof details.propertyAddress === "string") {
        await ensureNoDuplicateRent(transaction, {
          categoryId: schedule.categoryId,
          periodStart,
          periodEnd,
          propertyAddress: details.propertyAddress,
        });
      }
      const occurrence = existing ?? await transaction.expenseScheduleOccurrence.create({
        data: { scheduleId: id, dueAt },
      });
      const reference = `DEP-${dueAt.toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
      const expense = await transaction.expense.create({
        data: {
          reference,
          categoryId: schedule.categoryId,
          label: schedule.label,
          description: parsed.data.description || schedule.label,
          amount: parsed.data.amount,
          currency: schedule.currency,
          expenseDate: dueAt,
          dueDate: dueAt,
          invoiceDate,
          invoiceNumber: parsed.data.invoiceNumber || null,
          beneficiary: schedule.beneficiary,
          periodStart,
          periodEnd,
          details: details as Prisma.InputJsonValue,
          isDeposit,
          createdById: staff.userId,
          scheduledOccurrenceId: occurrence.id,
          status: parsed.data.initialPayment
            ? parsed.data.initialPayment.amount === parsed.data.amount ? "PAID" : "PARTIALLY_PAID"
            : "UNPAID",
          ...(parsed.data.initialPayment ? {
            payments: {
              create: {
                amount: parsed.data.initialPayment.amount,
                method: parsed.data.initialPayment.method,
                paidAt: paidAt!,
                createdById: staff.userId,
              },
            },
          } : {}),
        },
        include: { category: true, payments: true },
      });
      const nextDueAt = addFrequency(schedule.nextDueAt, schedule.frequency, schedule.customFrequencyDays);
      await transaction.expenseSchedule.update({ where: { id }, data: { nextDueAt } });
      await createExpenseAudit(transaction, {
        actorId: staff.userId,
        action: "EXPENSE_SCHEDULE_OCCURRENCE_RECORDED",
        targetId: expense.id,
        result: "SUCCESS",
        details: { scheduleId: id, occurrenceId: occurrence.id, dueAt: dueAt.toISOString(), nextDueAt: nextDueAt.toISOString() },
      });
      return { expense, nextDueAt };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json(result, { status: 201 });
  } catch (failure) {
    if (failure instanceof Error) {
      if (failure.message === "SCHEDULE_NOT_FOUND") return NextResponse.json({ error: "Échéance introuvable." }, { status: 404 });
      if (failure.message === "SCHEDULE_INACTIVE") return NextResponse.json({ error: "Cette échéance est désactivée." }, { status: 409 });
      if (failure.message === "SCHEDULE_FORBIDDEN") return NextResponse.json({ error: "Tu ne peux enregistrer que les échéances que tu as créées." }, { status: 403 });
      if (failure.message === "STALE_OCCURRENCE" || failure.message === "OCCURRENCE_ALREADY_RECORDED") return NextResponse.json({ error: "Cette échéance est déjà traitée ou a été modifiée. Recharge la liste avant de continuer." }, { status: 409 });
      if (failure.message === "INVALID_CATEGORY_DETAILS") return NextResponse.json({ error: "Les détails de la catégorie sont invalides." }, { status: 400 });
      if (failure.message === "INVALID_CATEGORY_FIELDS") return NextResponse.json({ error: "La référence de facture et les dates spécifiques à cette catégorie sont obligatoires." }, { status: 400 });
      if (failure.message === "PREPAID_REQUIRES_FULL_PAYMENT") return NextResponse.json({ error: "Une électricité prépayée doit être réglée intégralement." }, { status: 400 });
      if (failure.message === "DUPLICATE_RENT_PERIOD") return NextResponse.json({ error: "Un loyer existe déjà pour ce local et cette période. Utilise la dépense existante pour les paiements fractionnés." }, { status: 409 });
    }
    console.error("Expense schedule occurrence POST:", failure);
    return NextResponse.json({ error: "Impossible d’enregistrer cette occurrence." }, { status: 500 });
  }
}
