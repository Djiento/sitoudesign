import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";

type RouteContext = { params: Promise<{ id: string }> };

const solutionUpdateSchema = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  titleFr: z.string().trim().min(2).max(160).optional(),
  titleEn: z.string().trim().min(2).max(160).optional(),
  descriptionFr: z.string().trim().min(5).max(2000).optional(),
  descriptionEn: z.string().trim().min(5).max(2000).optional(),
  coverImage: z.string().trim().url().max(2000).or(z.literal("")).transform((value) => value || null).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

function refreshSolutions() {
  revalidatePath("/fr/solutions-entreprises");
  revalidatePath("/en/solutions-entreprises");
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const body: unknown = await request.json().catch(() => null);
  const parsed = solutionUpdateSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    return NextResponse.json({ error: "Aucune modification valide à enregistrer." }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const solution = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.businessSolution.update({ where: { id }, data: parsed.data });
      await transaction.managedContentSection.upsert({
        where: { key: "business-solutions" },
        update: {},
        create: { key: "business-solutions" },
      });
      return updated;
    });
    refreshSolutions();
    return NextResponse.json({ solution });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error) {
      if (error.code === "P2025") return NextResponse.json({ error: "Solution introuvable." }, { status: 404 });
      if (error.code === "P2002") return NextResponse.json({ error: "Cet identifiant URL est déjà utilisé." }, { status: 409 });
    }
    console.error("Admin business solutions PATCH:", error);
    return NextResponse.json({ error: "Impossible de modifier la solution." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const { id } = await context.params;
    await prisma.$transaction(async (transaction) => {
      await transaction.businessSolution.delete({ where: { id } });
      await transaction.managedContentSection.upsert({
        where: { key: "business-solutions" },
        update: {},
        create: { key: "business-solutions" },
      });
    });
    refreshSolutions();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Solution introuvable." }, { status: 404 });
    }
    console.error("Admin business solutions DELETE:", error);
    return NextResponse.json({ error: "Impossible de supprimer la solution." }, { status: 500 });
  }
}
