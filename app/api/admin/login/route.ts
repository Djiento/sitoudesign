
import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminCookieOptions,
  createStaffSession,
  safeCompare,
} from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { hashStaffPassword, verifyStaffPassword } from "@/lib/staff-password";


export async function POST(request: Request) {
  try {
    const expectedEmail = process.env.ADMIN_EMAIL;
    const expectedPassword = process.env.ADMIN_PASSWORD;

    if (!process.env.SESSION_SECRET) {
      console.error("Configuration SESSION_SECRET manquante.");
      return NextResponse.json(
        { error: "Configuration du serveur incomplète." },
        { status: 500 },
      );
    }

    const body = await request.json().catch(() => null);

    if (
      !body ||
      typeof body.email !== "string" ||
      typeof body.password !== "string" ||
      body.email.length > 254 ||
      body.password.length > 1024
    ) {
      return NextResponse.json(
        { error: "Identifiants invalides." },
        { status: 400 },
      );
    }

    const adminEmail = expectedEmail?.trim().toLowerCase();
    const validEmail = Boolean(adminEmail && safeCompare(
      body.email.trim().toLowerCase(),
      adminEmail,
    ));
    const validPassword = Boolean(expectedPassword && safeCompare(body.password, expectedPassword));

    let token: string | null = null;
    let mustChangePassword = false;
    if (adminEmail && expectedPassword && validEmail && validPassword) {
      const admin = await prisma.staffUser.upsert({
        where: { email: adminEmail },
        update: {
          fullName: "Administrateur",
          passwordHash: hashStaffPassword(expectedPassword),
          role: "ADMIN",
          isActive: true,
          mustChangePassword: false,
        },
        create: {
          email: adminEmail,
          fullName: "Administrateur",
          passwordHash: hashStaffPassword(expectedPassword),
          role: "ADMIN",
          isActive: true,
          mustChangePassword: false,
        },
      });
      token = await createStaffSession({
        id: admin.id,
        email: admin.email,
        role: admin.role,
        mustChangePassword: false,
        sessionVersion: admin.sessionVersion,
      });
    } else {
      const staff = await prisma.staffUser.findUnique({
        where: { email: body.email.trim().toLowerCase() },
      });
      if (staff?.isActive && verifyStaffPassword(body.password, staff.passwordHash)) {
        mustChangePassword = staff.mustChangePassword;
        token = await createStaffSession({
          id: staff.id,
          email: staff.email,
          role: staff.role,
          mustChangePassword: staff.mustChangePassword,
          sessionVersion: staff.sessionVersion,
        });
      }
    }
    if (!token) {
      return NextResponse.json({ error: "Adresse e-mail ou mot de passe incorrect." }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      mustChangePassword,
    });

    response.cookies.set(ADMIN_COOKIE, token, adminCookieOptions);

    return response;
  } catch (error) {
    console.error("Erreur de connexion administrateur :", error);

    return NextResponse.json(
      { error: "Impossible de se connecter pour le moment." },
      { status: 500 },
    );
  }
}
