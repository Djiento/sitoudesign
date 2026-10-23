
import { NextResponse } from "next/server";
import { getStaffSession, isAdminAuthenticated } from "@/lib/admin-auth";

export async function requireAdmin() {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 },
    );
  }

  return null;
}

export async function requireAdminOrManager() {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  if (staff.role !== "ADMIN" && staff.role !== "MANAGER") {
    return NextResponse.json({ error: "Cette action est réservée aux responsables de stock." }, { status: 403 });
  }
  return null;
}

export async function requireStaff() {
  const staff = await getStaffSession();
  if (!staff) {
    return {
      staff: null,
      error: NextResponse.json({ error: "Authentification requise." }, { status: 401 }),
    };
  }
  if (staff.mustChangePassword) {
    return {
      staff: null,
      error: NextResponse.json({ error: "Change ton mot de passe temporaire avant de continuer." }, { status: 403 }),
    };
  }
  return { staff, error: null };
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}