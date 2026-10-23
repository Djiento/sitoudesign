import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";

const solutionSchema = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  titleFr: z.string().trim().min(2).max(160),
  titleEn: z.string().trim().min(2).max(160),
  descriptionFr: z.string().trim().min(5).max(2000),
  descriptionEn: z.string().trim().min(5).max(2000),
  coverImage: z.string().trim().url().max(2000).or(z.literal("")).transform((value) => value || null).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10000).default(0),
});

function refreshSolutions() {
  revalidatePath("/fr/solutions-entreprises");
  revalidatePath("/en/solutions-entreprises");
}

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const solutions = await prisma.businessSolution.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ solutions });
  } catch (error) {
    console.error("Admin business solutions GET:", error);
    return NextResponse.json({ error: "Impossible de charger les solutions entreprises." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const body: unknown = await request.json().catch(() => null);
  const parsed = solutionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Vérifie les champs français et anglais de la solution." }, { status: 400 });
  }

  try {
    const solution = await prisma.$transaction(async (transaction) => {
      const created = await transaction.businessSolution.create({ data: parsed.data });
      await transaction.managedContentSection.upsert({
        where: { key: "business-solutions" },
        update: {},
        create: { key: "business-solutions" },
      });
      return created;
    });
    refreshSolutions();
    return NextResponse.json({ solution }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Cet identifiant URL est déjà utilisé." }, { status: 409 });
    }
    console.error("Admin business solutions POST:", error);
    return NextResponse.json({ error: "Impossible d’enregistrer la solution." }, { status: 500 });
  }
}
