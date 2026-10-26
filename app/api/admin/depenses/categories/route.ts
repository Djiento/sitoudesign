import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/admin-api";
import { ensureExpenseCategories, isExpenseManager } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";

const categorySchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60),
  nameFr: z.string().trim().min(2).max(120),
  nameEn: z.string().trim().min(2).max(120),
  sortOrder: z.number().int().min(0).max(10_000).default(100),
}).strict();

export async function GET() {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  try {
    await ensureExpenseCategories();
    const categories = await prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { nameFr: "asc" }],
    });
    return NextResponse.json({ categories });
  } catch (failure) {
    console.error("Expense categories GET:", failure);
    return NextResponse.json({ error: "Impossible de charger les catégories." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  if (!isExpenseManager(staff.role)) return NextResponse.json({ error: "La gestion des catégories est réservée aux responsables." }, { status: 403 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Vérifie l’identifiant et les noms de la catégorie." }, { status: 400 });
  try {
    const category = await prisma.$transaction(async (transaction) => {
      const created = await transaction.expenseCategory.create({
        data: { ...parsed.data, isBuiltin: false },
      });
      await transaction.auditEvent.create({
        data: {
          actorId: staff.userId,
          action: "EXPENSE_CATEGORY_CREATED",
          targetType: "ExpenseCategory",
          targetId: created.id,
          result: "SUCCESS",
          details: { slug: created.slug, nameFr: created.nameFr, nameEn: created.nameEn },
        },
      });
      return created;
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (failure) {
    if (failure instanceof Error && "code" in failure && failure.code === "P2002") {
      return NextResponse.json({ error: "Cette catégorie existe déjà." }, { status: 409 });
    }
    console.error("Expense category POST:", failure);
    return NextResponse.json({ error: "Impossible de créer la catégorie." }, { status: 500 });
  }
}
