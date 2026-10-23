import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_COOKIE, adminCookieOptions, createStaffSession, getStaffSession } from "@/lib/admin-auth";
import { hashStaffPassword } from "@/lib/staff-password";
import { prisma } from "@/lib/prisma";

const passwordSchema = z.object({
  password: z.string().min(12).max(128),
});

export async function POST(request: NextRequest) {
  const session = await getStaffSession();
  if (!session?.userId || !session.mustChangePassword) {
    return NextResponse.json({ error: "Aucun changement de mot de passe obligatoire." }, { status: 403 });
  }
  const body: unknown = await request.json().catch(() => null);
  const parsed = passwordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Le nouveau mot de passe doit contenir au moins 12 caractères." }, { status: 400 });

  try {
    const user = await prisma.staffUser.update({
      where: { id: session.userId },
      data: { passwordHash: hashStaffPassword(parsed.data.password), mustChangePassword: false, sessionVersion: { increment: 1 } },
    });
    const token = await createStaffSession({
      id: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: false,
      sessionVersion: user.sessionVersion,
    });
    const response = NextResponse.json({ success: true });
    response.cookies.set(ADMIN_COOKIE, token, adminCookieOptions);
    return response;
  } catch (error) {
    console.error("Staff password change:", error);
    return NextResponse.json({ error: "Impossible de modifier le mot de passe." }, { status: 500 });
  }
}
