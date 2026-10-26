import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireStaff } from "@/lib/admin-api";
import { expenseInputSchema, parseCategoryDetails, validateExpenseCategoryFields } from "@/lib/expense-validation";
import { createExpenseAudit, ensureNoDuplicateRent, getExpenseStatus, isExpenseManager, todayInBenin, toValidDate } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  const { id } = await context.params;
  try {
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
      },
    });
    if (!expense) return NextResponse.json({ error: "Dépense introuvable." }, { status: 404 });
    if (staff.role === "CASHIER" && expense.createdById !== staff.userId) {
      return NextResponse.json({ error: "Tu ne peux consulter que les dépenses que tu as saisies." }, { status: 403 });
    }
    const auditEvents = isExpenseManager(staff.role) || staff.canApproveExpenses
      ? await prisma.auditEvent.findMany({
        where: { targetType: "Expense", targetId: id },
        include: { actor: { select: { fullName: true } } },
        orderBy: { occurredAt: "desc" },
        take: 100,
      })
      : [];
    const paidAmount = expense.payments.reduce((sum, payment) => sum + (payment.isVoided ? 0 : payment.amount), 0);
    const today = toValidDate(todayInBenin())!;
    const status = expense.status !== "CANCELLED" && expense.dueDate && expense.dueDate < today
      && paidAmount < expense.amount
      ? "OVERDUE"
      : getExpenseStatus(expense.amount, paidAmount, expense.status);
    return NextResponse.json({
      expense: {
        ...expense,
        paidAmount,
        remainingAmount: Math.max(0, expense.amount - paidAmount),
        status,
      },
      auditEvents,
    });
  } catch (failure) {
    console.error("Expense detail GET:", failure);
    return NextResponse.json({ error: "Impossible de charger le détail de la dépense." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  const { id } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = expenseInputSchema.safeParse(body);
  if (!parsed.success || parsed.data.initialPayment) {
    return NextResponse.json({ error: "Les champs modifiés sont invalides." }, { status: 400 });
  }
  const input = parsed.data;
  const expenseDate = toValidDate(input.expenseDate);
  const dueDate = input.dueDate ? toValidDate(input.dueDate) : null;
  const invoiceDate = input.invoiceDate ? toValidDate(input.invoiceDate) : null;
  const periodStart = input.periodStart ? toValidDate(input.periodStart) : null;
  const periodEnd = input.periodEnd ? toValidDate(input.periodEnd) : null;
  if (
    !expenseDate || (input.dueDate && !dueDate) || (input.invoiceDate && !invoiceDate)
    || (input.periodStart && !periodStart) || (input.periodEnd && !periodEnd)
    || (dueDate && dueDate < expenseDate) || (invoiceDate && invoiceDate > expenseDate)
    || (periodStart && periodEnd && periodStart > periodEnd)
  ) return NextResponse.json({ error: "Les dates de dépense ou de période sont incohérentes." }, { status: 400 });

  try {
    const [expense, category] = await Promise.all([
      prisma.expense.findUnique({
        where: { id },
        include: { payments: { where: { isVoided: false }, select: { amount: true } } },
      }),
      prisma.expenseCategory.findFirst({
        where: { id: input.categoryId, isActive: true },
        select: { id: true, slug: true },
      }),
    ]);
    if (!expense) return NextResponse.json({ error: "Dépense introuvable." }, { status: 404 });
    if (staff.role === "CASHIER" && expense.createdById !== staff.userId) {
      return NextResponse.json({ error: "Tu ne peux modifier que les dépenses que tu as saisies." }, { status: 403 });
    }
    if (expense.status === "CANCELLED" || expense.cancellationStatus === "REQUESTED") {
      return NextResponse.json({ error: "Une dépense annulée ou en attente d’annulation ne peut pas être modifiée." }, { status: 409 });
    }
    if (!category) return NextResponse.json({ error: "La catégorie choisie n’est pas disponible." }, { status: 400 });
    if (expense.payments.length && expense.categoryId !== category.id) {
      return NextResponse.json({ error: "La catégorie ne peut pas changer après l’enregistrement d’un paiement." }, { status: 409 });
    }
    const detailsResult = parseCategoryDetails(category.slug, input.details);
    if (!detailsResult.success) return NextResponse.json({ error: "Les informations propres à cette catégorie sont invalides." }, { status: 400 });
    const categoryError = validateExpenseCategoryFields(category.slug, detailsResult.data, {
      invoiceNumber: input.invoiceNumber,
      invoiceDate,
      periodStart,
      periodEnd,
    });
    if (categoryError) return NextResponse.json({ error: categoryError }, { status: 400 });
    const totalPaid = expense.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const isPrepaid = category.slug === "electricity"
      && "type" in detailsResult.data && detailsResult.data.type === "PREPAID";
    const isDeposit = category.slug === "rent"
      && "paymentType" in detailsResult.data && detailsResult.data.paymentType === "DEPOSIT";
    if (input.amount < totalPaid || (isPrepaid && totalPaid !== input.amount)) {
      return NextResponse.json({ error: "Le montant ne peut pas être inférieur aux paiements déjà enregistrés." }, { status: 409 });
    }
    const updated = await prisma.$transaction(async (transaction) => {
      if (!isDeposit && category.slug === "rent" && periodStart && periodEnd
        && "propertyAddress" in detailsResult.data && typeof detailsResult.data.propertyAddress === "string") {
        await ensureNoDuplicateRent(transaction, {
          categoryId: category.id,
          periodStart,
          periodEnd,
          propertyAddress: detailsResult.data.propertyAddress,
          excludeExpenseId: id,
        });
      }
      const result = await transaction.expense.update({
        where: { id },
        data: {
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
          details: detailsResult.data as Prisma.InputJsonValue,
          isDeposit,
          status: getExpenseStatus(input.amount, totalPaid, expense.status),
          updatedById: staff.userId,
        },
        include: { category: true },
      });
      await createExpenseAudit(transaction, {
        actorId: staff.userId,
        action: "EXPENSE_UPDATED",
        targetId: id,
        result: "SUCCESS",
        details: {
          before: {
            amount: expense.amount,
            categoryId: expense.categoryId,
            label: expense.label,
            description: expense.description,
            currency: expense.currency,
            beneficiary: expense.beneficiary,
            expenseDate: expense.expenseDate.toISOString(),
            dueDate: expense.dueDate?.toISOString() ?? null,
            invoiceDate: expense.invoiceDate?.toISOString() ?? null,
            invoiceNumber: expense.invoiceNumber,
            periodStart: expense.periodStart?.toISOString() ?? null,
            periodEnd: expense.periodEnd?.toISOString() ?? null,
            internalComment: expense.internalComment,
            details: expense.details ?? {},
            isDeposit: expense.isDeposit,
            status: expense.status,
          },
          after: {
            amount: result.amount,
            categoryId: result.categoryId,
            label: result.label,
            description: result.description,
            currency: result.currency,
            beneficiary: result.beneficiary,
            expenseDate: result.expenseDate.toISOString(),
            dueDate: result.dueDate?.toISOString() ?? null,
            invoiceDate: result.invoiceDate?.toISOString() ?? null,
            invoiceNumber: result.invoiceNumber,
            periodStart: result.periodStart?.toISOString() ?? null,
            periodEnd: result.periodEnd?.toISOString() ?? null,
            internalComment: result.internalComment,
            details: result.details ?? {},
            isDeposit: result.isDeposit,
            status: result.status,
          },
        },
      });
      return result;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ expense: updated });
  } catch (failure) {
    if (failure instanceof Error && failure.message === "DUPLICATE_RENT_PERIOD") {
      return NextResponse.json({ error: "Un loyer existe déjà pour ce local et cette période. Ajoute les versements suivants comme paiements fractionnés à la dépense existante." }, { status: 409 });
    }
    console.error("Expense PATCH:", failure);
    return NextResponse.json({ error: "Impossible de modifier la dépense." }, { status: 500 });
  }
}
