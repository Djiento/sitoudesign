import { NextRequest, NextResponse } from "next/server";
import { ExpensePaymentMethod } from "@prisma/client";
import { z } from "zod";
import { requireStaff } from "@/lib/admin-api";
import { buildExpenseReport } from "@/lib/expense-reports";

const reportQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  currency: z.string().regex(/^[A-Z]{3}$/).default("XOF"),
  categoryId: z.string().max(100).optional(),
  status: z.enum(["ALL", "UNPAID", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"]).default("ALL"),
  method: z.nativeEnum(ExpensePaymentMethod).optional(),
  beneficiary: z.string().trim().max(180).optional(),
  locale: z.enum(["fr", "en"]).default("fr"),
});

export async function GET(request: NextRequest) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  if (staff.role !== "ADMIN" && !staff.canExportReports) {
    return NextResponse.json({ error: "L’accès aux rapports financiers n’est pas autorisé." }, { status: 403 });
  }
  const parsed = reportQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Les filtres du rapport sont invalides." }, { status: 400 });
  try {
    const report = await buildExpenseReport({
      ...parsed.data,
      userId: staff.role === "CASHIER" ? staff.userId : undefined,
      english: parsed.data.locale === "en",
    });
    return NextResponse.json(report);
  } catch (failure) {
    console.error("Expense report GET:", failure);
    return NextResponse.json({ error: "Impossible de générer les données du rapport." }, { status: 500 });
  }
}
