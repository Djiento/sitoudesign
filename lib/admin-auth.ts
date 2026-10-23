
import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import type { StaffRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const ADMIN_COOKIE = "sitou_admin_session";
const SESSION_DURATION = 8 * 60 * 60;
const secret = process.env.SESSION_SECRET;

function getSecret() {
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET doit contenir au moins 32 caractères.");
  }

  return new TextEncoder().encode(secret);
}

export function safeCompare(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();

  return timingSafeEqual(hashA, hashB);
}

export async function createAdminSession() {
  return new SignJWT({ role: "ADMIN" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecret());
}

export async function createStaffSession(user: {
  id: string;
  email: string;
  role: StaffRole;
  mustChangePassword: boolean;
  sessionVersion: number;
}) {
  return new SignJWT({
    role: user.role,
    userId: user.id,
    email: user.email,
    mustChangePassword: user.mustChangePassword,
    sessionVersion: user.sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecret());
}

export type StaffSession = {
  userId: string;
  email: string;
  fullName: string;
  role: StaffRole;
  mustChangePassword: boolean;
  sessionVersion: number;
  maxDiscountPercent: number;
  canApproveRefunds: boolean;
  canApproveExpenses: boolean;
  canExportReports: boolean;
};

export async function getStaffSession(): Promise<StaffSession | null> {
  await connection();

  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });

    if (
      (payload.role !== "ADMIN" && payload.role !== "MANAGER" && payload.role !== "CASHIER")
      || typeof payload.userId !== "string"
      || typeof payload.email !== "string"
      || typeof payload.sessionVersion !== "number"
    ) return null;
    const user = await prisma.staffUser.findUnique({
      where: { id: payload.userId },
      select: {
        id: true, email: true, fullName: true, role: true, isActive: true, mustChangePassword: true,
        sessionVersion: true, maxDiscountPercent: true, canApproveRefunds: true,
        canApproveExpenses: true, canExportReports: true,
      },
    });
    if (
      !user || !user.isActive || user.email !== payload.email || user.role !== payload.role
      || user.sessionVersion !== payload.sessionVersion
    ) return null;
    return {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      sessionVersion: user.sessionVersion,
      maxDiscountPercent: user.maxDiscountPercent,
      canApproveRefunds: user.canApproveRefunds,
      canApproveExpenses: user.canApproveExpenses,
      canExportReports: user.canExportReports,
    };
  } catch {
    return null;
  }
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const session = await getStaffSession();
  return session?.role === "ADMIN";
}

export const adminCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DURATION,
};
