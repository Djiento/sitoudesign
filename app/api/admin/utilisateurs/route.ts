import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStaffSession } from "@/lib/admin-auth";
import { requireAdmin } from "@/lib/admin-api";
import { parseAdminPagination } from "@/lib/admin-pagination";
import { prisma } from "@/lib/prisma";
import { hashStaffPassword } from "@/lib/staff-password";

const createUserSchema = z.object({
  email: z.string().trim().email().max(254),
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(["MANAGER", "CASHIER"]).default("CASHIER"),
  maxDiscountPercent: z.number().int().min(0).max(100).default(0),
  canApproveRefunds: z.boolean().default(false),
  canApproveExpenses: z.boolean().default(false),
  canExportReports: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const pagination = parseAdminPagination(request.nextUrl.searchParams);
  if (!pagination.success) {
    return NextResponse.json({ error: "Les paramètres de pagination sont invalides." }, { status: 400 });
  }

  const total = await prisma.staffUser.count();
  const totalPages = Math.max(1, Math.ceil(total / pagination.data.pageSize));
  const page = Math.min(pagination.data.page, totalPages);
  const users = await prisma.staffUser.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      maxDiscountPercent: true,
      canApproveRefunds: true,
      canApproveExpenses: true,
      canExportReports: true,
      createdAt: true,
    },
    orderBy: [{ role: "asc" }, { fullName: "asc" }, { id: "asc" }],
    skip: (page - 1) * pagination.data.pageSize,
    take: pagination.data.pageSize,
  });
  return NextResponse.json({
    users,
    pagination: { page, pageSize: pagination.data.pageSize, total, totalPages },
  });
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const actor = await getStaffSession();
  if (!actor?.userId) return NextResponse.json({ error: "Reconnecte-toi pour effectuer cette action." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Vérifie le nom, l’e-mail et les permissions." }, { status: 400 });

  const temporaryPassword = randomBytes(15).toString("base64url");
  try {
    const user = await prisma.$transaction(async (transaction) => {
      const created = await transaction.staffUser.create({
        data: {
          ...parsed.data,
          email: parsed.data.email.toLowerCase(),
          passwordHash: hashStaffPassword(temporaryPassword),
          role: parsed.data.role,
          mustChangePassword: true,
        },
        select: { id: true, email: true, fullName: true, role: true },
      });
      await transaction.auditEvent.create({
        data: {
          actorId: actor.userId!,
          action: "STAFF_USER_CREATED",
          targetType: "StaffUser",
          targetId: created.id,
          result: "SUCCESS",
          details: { email: created.email, role: created.role },
        },
      });
      return created;
    });
    return NextResponse.json({ user, temporaryPassword }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Un compte utilise déjà cette adresse e-mail." }, { status: 409 });
    }
    console.error("Admin staff user POST:", error);
    return NextResponse.json({ error: "Impossible de créer le compte utilisateur." }, { status: 500 });
  }
}
