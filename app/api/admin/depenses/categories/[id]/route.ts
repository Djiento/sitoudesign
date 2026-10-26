import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/admin-api";
import { isExpenseManager } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };
const updateCategorySchema = z.object({
  nameFr: z.string().trim().min(2).max(120),
  nameEn: z.string().trim().min(2).max(120),
  sortOrder: z.number().int().min(0).max(10_000),
  isActive: z.boolean(),
}).strict();

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  if (!isExpenseManager(staff.role)) return NextResponse.json({ error: "La gestion des catégories est réservée aux responsables." }, { status: 403 });
  const { id } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Les informations de la catégorie sont invalides." }, { status: 400 });
  try {
    const category = await prisma.$transaction(async (transaction) => {
      const previous = await transaction.expenseCategory.findUnique({ where: { id } });
      if (!previous) throw new Error("CATEGORY_NOT_FOUND");
      const updated = await transaction.expenseCategory.update({ where: { id }, data: parsed.data });
      await transaction.auditEvent.create({
        data: {
          actorId: staff.userId,
          action: "EXPENSE_CATEGORY_UPDATED",
          targetType: "ExpenseCategory",
          targetId: id,
          result: "SUCCESS",
          details: {
            before: { nameFr: previous.nameFr, nameEn: previous.nameEn, isActive: previous.isActive, sortOrder: previous.sortOrder },
            after: { nameFr: updated.nameFr, nameEn: updated.nameEn, isActive: updated.isActive, sortOrder: updated.sortOrder },
          },
        },
      });
      return updated;
    });
    return NextResponse.json({ category });
  } catch (failure) {
    if (failure instanceof Error && failure.message === "CATEGORY_NOT_FOUND") {
      return NextResponse.json({ error: "Catégorie introuvable." }, { status: 404 });
    }
    console.error("Expense category PATCH:", failure);
    return NextResponse.json({ error: "Impossible de modifier la catégorie." }, { status: 500 });
  }
}
