import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStaffSession } from "@/lib/admin-auth";
import { requireAdmin } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { hashStaffPassword } from "@/lib/staff-password";

type RouteContext = { params: Promise<{ id: string }> };

const updateUserSchema = z.object({
  role: z.enum(["MANAGER", "CASHIER"]).optional(),
  isActive: z.boolean().optional(),
  maxDiscountPercent: z.number().int().min(0).max(100).optional(),
  canApproveRefunds: z.boolean().optional(),
  canApproveExpenses: z.boolean().optional(),
  canExportReports: z.boolean().optional(),
  resetPassword: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authError = await requireAdmin();
  if (authError) return authError;
  const actor = await getStaffSession();
  if (!actor?.userId) return NextResponse.json({ error: "Reconnecte-toi pour effectuer cette action." }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    return NextResponse.json({ error: "Aucune modification valide." }, { status: 400 });
  }

  const { id } = await context.params;
  if (actor.userId === id && parsed.data.isActive === false) {
    return NextResponse.json({ error: "Tu ne peux pas désactiver ton propre compte." }, { status: 400 });
  }
  if (actor.userId === id && parsed.data.role && parsed.data.role !== actor.role) {
    return NextResponse.json({ error: "Tu ne peux pas modifier ton propre rôle." }, { status: 400 });
  }
  const temporaryPassword = parsed.data.resetPassword ? randomBytes(15).toString("base64url") : undefined;
  const { resetPassword: _resetPassword, ...changes } = parsed.data;

  try {
    const user = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.staffUser.findUnique({ where: { id } });
      if (!existing) return null;
      const updated = await transaction.staffUser.update({
        where: { id },
        data: {
          ...changes,
          sessionVersion: { increment: 1 },
          ...(temporaryPassword ? {
            passwordHash: hashStaffPassword(temporaryPassword),
            mustChangePassword: true,
          } : {}),
        },
        select: {
          id: true, email: true, fullName: true, role: true, isActive: true,
          maxDiscountPercent: true, canApproveRefunds: true, canApproveExpenses: true, canExportReports: true,
        },
      });
      await transaction.auditEvent.create({
        data: {
          actorId: actor.userId!,
          action: temporaryPassword ? "STAFF_USER_PASSWORD_RESET" : "STAFF_USER_UPDATED",
          targetType: "StaffUser",
          targetId: id,
          result: "SUCCESS",
          details: changes,
        },
      });
      return updated;
    });
    if (!user) return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
    return NextResponse.json({ user, ...(temporaryPassword ? { temporaryPassword } : {}) });
  } catch (error) {
    console.error("Admin staff user PATCH:", error);
    return NextResponse.json({ error: "Impossible de modifier le compte utilisateur." }, { status: 500 });
  }
}
