import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const quotes = await prisma.quoteRequest.findMany({
      orderBy: [{ createdAt: "desc" }],
    });
    return NextResponse.json({ quotes });
  } catch (error) {
    console.error("Admin quotes GET:", error);
    return NextResponse.json({ error: "Impossible de charger les demandes de devis." }, { status: 500 });
  }
}
