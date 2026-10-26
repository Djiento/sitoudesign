import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireStaff } from "@/lib/admin-api";
import { expenseInputSchema, expenseListStatusSchema, parseCategoryDetails, validateExpenseCategoryFields } from "@/lib/expense-validation";
import { createExpenseAudit, ensureExpenseCategories, ensureNoDuplicateRent, getExpenseStatus, ownerFilter, todayInBenin, toValidDate } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";

function parsePositiveInteger(value: string | null, fallback: number, max: number) {
  if (!value) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= max ? parsed : null;
}

export async function GET(request: NextRequest) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  try {
    await ensureExpenseCategories();
    const params = request.nextUrl.searchParams;
    const page = parsePositiveInteger(params.get("page"), 1, 1_000_000);
    const pageSize = parsePositiveInteger(params.get("pageSize"), 15, 100);
    if (!page || !pageSize) return NextResponse.json({ error: "La pagination demandée est invalide." }, { status: 400 });
    const statusInput = params.get("status") || "ALL";
    const parsedStatus = expenseListStatusSchema.safeParse(statusInput);
    if (!parsedStatus.success) return NextResponse.json({ error: "Le statut sélectionné est invalide." }, { status: 400 });
    const search = params.get("search")?.trim().slice(0, 120) ?? "";
    const currency = params.get("currency") || "";
    if (currency && !/^[A-Z]{3}$/.test(currency)) return NextResponse.json({ error: "La devise sélectionnée est invalide." }, { status: 400 });
    const today = toValidDate(todayInBenin())!;
    const where: Prisma.ExpenseWhereInput = {
      ...ownerFilter(staff.userId, staff.role !== "CASHIER"),
      ...(currency ? { currency } : {}),
      ...(params.get("categoryId") ? { categoryId: params.get("categoryId")! } : {}),
      ...(parsedStatus.data === "OPEN"
        ? { status: { in: ["UNPAID", "PARTIALLY_PAID"] } }
        : parsedStatus.data === "OVERDUE"
        ? { status: { in: ["UNPAID", "PARTIALLY_PAID"] }, dueDate: { lt: today } }
        : parsedStatus.data !== "ALL" ? { status: parsedStatus.data } : {}),
      ...(search ? {
        OR: [
          { reference: { contains: search, mode: "insensitive" } },
          { label: { contains: search, mode: "insensitive" } },
          { beneficiary: { contains: search, mode: "insensitive" } },
          { invoiceNumber: { contains: search, mode: "insensitive" } },
        ],
      } : {}),
    };
    const from = params.get("from");
    const to = params.get("to");
    if (from || to) {
      const start = from ? toValidDate(from) : null;
      const end = to ? toValidDate(to) : null;
      if ((from && !start) || (to && !end) || (start && end && start > end)) {
        return NextResponse.json({ error: "Les dates de filtre sont invalides." }, { status: 400 });
      }
      where.expenseDate = {
        ...(start ? { gte: start } : {}),
        ...(end ? { lt: new Date(end.getTime() + 86_400_000) } : {}),
      };
    }
    const [total, rows, categories] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        include: {
          category: true,
          createdBy: { select: { id: true, fullName: true } },
          payments: { select: { amount: true, isVoided: true, paidAt: true, method: true } },
        },
        orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.expenseCategory.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { nameFr: "asc" }],
        select: { id: true, slug: true, nameFr: true, nameEn: true, isBuiltin: true },
      }),
    ]);
    const expenses = rows.map(({ payments, ...expense }) => {
      const paidAmount = payments.reduce((sum, payment) => sum + (payment.isVoided ? 0 : payment.amount), 0);
      const status = expense.status !== "CANCELLED" && expense.dueDate && expense.dueDate < today
        && paidAmount < expense.amount
        ? "OVERDUE"
        : getExpenseStatus(expense.amount, paidAmount, expense.status);
      return { ...expense, paidAmount, remainingAmount: Math.max(0, expense.amount - paidAmount), status };
    });
    return NextResponse.json({ expenses, categories, page, pageSize, total, pageCount: Math.ceil(total / pageSize) });
  } catch (failure) {
    console.error("Expense list GET:", failure);
    return NextResponse.json({ error: "Impossible de charger les dépenses." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  const body: unknown = await request.json().catch(() => null);
  const parsed = expenseInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Vérifie les champs obligatoires et les montants saisis." }, { status: 400 });

  const input = parsed.data;
  const expenseDate = toValidDate(input.expenseDate);
  const dueDate = input.dueDate ? toValidDate(input.dueDate) : null;
  const invoiceDate = input.invoiceDate ? toValidDate(input.invoiceDate) : null;
  const periodStart = input.periodStart ? toValidDate(input.periodStart) : null;
  const periodEnd = input.periodEnd ? toValidDate(input.periodEnd) : null;
  const paidAt = input.initialPayment?.paidAt ? toValidDate(input.initialPayment.paidAt) : expenseDate;
  if (
    !expenseDate || (input.dueDate && !dueDate) || (input.invoiceDate && !invoiceDate)
    || (input.periodStart && !periodStart) || (input.periodEnd && !periodEnd)
    || (input.initialPayment?.paidAt && !paidAt)
    || (dueDate && dueDate < expenseDate) || (invoiceDate && invoiceDate > expenseDate)
    || (periodStart && periodEnd && periodStart > periodEnd)
    || (input.initialPayment && paidAt && (
      paidAt < expenseDate || paidAt.toISOString().slice(0, 10) > todayInBenin()
    ))
  ) return NextResponse.json({ error: "Les dates de dépense, de paiement ou de période sont incohérentes." }, { status: 400 });

  try {
    const category = await prisma.expenseCategory.findFirst({
      where: { id: input.categoryId, isActive: true },
      select: { id: true, slug: true },
    });
    if (!category) return NextResponse.json({ error: "La catégorie choisie n’est pas disponible." }, { status: 400 });
    const detailsResult = parseCategoryDetails(category.slug, input.details);
    if (!detailsResult.success) return NextResponse.json({ error: "Les informations propres à cette catégorie sont incomplètes ou invalides." }, { status: 400 });
    const details = detailsResult.data;
    const categoryError = validateExpenseCategoryFields(category.slug, details, {
      invoiceNumber: input.invoiceNumber,
      invoiceDate,
      periodStart,
      periodEnd,
    });
    if (categoryError) return NextResponse.json({ error: categoryError }, { status: 400 });
    const isPrepaidElectricity = category.slug === "electricity"
      && "type" in details && details.type === "PREPAID";
    const isDeposit = category.slug === "rent"
      && "paymentType" in details && details.paymentType === "DEPOSIT";
    if (
      (isPrepaidElectricity && input.initialPayment?.amount !== input.amount)
      || (input.initialPayment && input.initialPayment.amount > input.amount)
    ) return NextResponse.json({ error: "Une électricité prépayée doit être réglée intégralement dès sa saisie." }, { status: 400 });

    const reference = `DEP-${expenseDate.toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const created = await prisma.$transaction(async (transaction) => {
      if (!isDeposit && category.slug === "rent" && periodStart && periodEnd
        && "propertyAddress" in details && typeof details.propertyAddress === "string") {
        await ensureNoDuplicateRent(transaction, {
          categoryId: category.id, periodStart, periodEnd, propertyAddress: details.propertyAddress,
        });
      }
      const expense = await transaction.expense.create({
        data: {
          reference,
          categoryId: category.id,
          label: input.label,
          description: input.description,
          amount: input.amount,
          currency: input.currency,
          expenseDate,
          dueDate,
          invoiceDate,
          invoiceNumber: input.invoiceNumber || null,
          beneficiary: input.beneficiary,
          periodStart,
          periodEnd,
          internalComment: input.internalComment || null,
          details: details as Prisma.InputJsonValue,
          isDeposit,
          createdById: staff.userId,
          status: input.initialPayment
            ? input.initialPayment.amount === input.amount ? "PAID" : "PARTIALLY_PAID"
            : "UNPAID",
          ...(input.initialPayment ? {
            payments: {
              create: {
                amount: input.initialPayment.amount,
                method: input.initialPayment.method,
                paidAt: paidAt!,
                reference: input.initialPayment.reference || null,
                comment: input.initialPayment.comment || null,
                createdById: staff.userId,
              },
            },
          } : {}),
        },
        include: { category: true, payments: true },
      });
      await createExpenseAudit(transaction, {
        actorId: staff.userId,
        action: "EXPENSE_CREATED",
        targetId: expense.id,
        result: "SUCCESS",
        details: {
          reference: expense.reference,
          amount: expense.amount,
          currency: expense.currency,
          categoryId: expense.categoryId,
          initialPayment: input.initialPayment?.amount ?? 0,
        },
      });
      if (input.initialPayment) {
        await createExpenseAudit(transaction, {
          actorId: staff.userId,
          action: "EXPENSE_PAYMENT_RECORDED",
          targetId: expense.id,
          result: "SUCCESS",
          details: { amount: input.initialPayment.amount, method: input.initialPayment.method },
        });
      }
      return expense;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ expense: created }, { status: 201 });
  } catch (failure) {
    if (failure instanceof Error && failure.message === "DUPLICATE_RENT_PERIOD") {
      return NextResponse.json({ error: "Un loyer existe déjà pour ce local et cette période. Ajoute les versements suivants comme paiements fractionnés à la dépense existante." }, { status: 409 });
    }
    console.error("Expense POST:", failure);
    return NextResponse.json({ error: "Impossible d’enregistrer la dépense." }, { status: 500 });
  }
}
