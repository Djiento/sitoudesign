import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { QuoteStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const quoteUpdateSchema = z.object({
  status: z.nativeEnum(QuoteStatus).optional(),
  internalNote: z.string().trim().max(5000).nullable().optional(),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const body: unknown = await request.json().catch(() => null);
  const parsed = quoteUpdateSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    return NextResponse.json({ error: "Aucune modification valide à enregistrer." }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const quote = await prisma.quoteRequest.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ quote });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Demande de devis introuvable." }, { status: 404 });
    }
    console.error("Admin quotes PATCH:", error);
    return NextResponse.json({ error: "Impossible de modifier la demande." }, { status: 500 });
  }
}
