
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";

const productSchema = z.object({
  slug: z.string().trim().min(1).max(150)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nameFr: z.string().trim().min(1).max(200),
  nameEn: z.string().trim().min(1).max(200),
  descriptionFr: z.string().trim().min(1).max(10000),
  descriptionEn: z.string().trim().min(1).max(10000),
  shortDescFr: z.string().trim().max(500).optional(),
  shortDescEn: z.string().trim().max(500).optional(),
  categoryId: z.string().min(1),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
});

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        category: { select: { id: true, nameFr: true, nameEn: true } },
        media: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { nameFr: "asc" }],
      select: { id: true, nameFr: true, nameEn: true },
    }),
  ]);

  return NextResponse.json({ products, categories });
}

export async function POST(request: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const body: unknown = await request.json().catch(() => null);
  const parsed = productSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Vérifie les champs du produit.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const category = await prisma.category.findUnique({
    where: { id: parsed.data.categoryId },
  });

  if (!category || !category.isActive) {
    return NextResponse.json(
      { error: "La catégorie sélectionnée est introuvable ou inactive." },
      { status: 400 },
    );
  }

  try {
    const product = await prisma.product.create({
      data: {
        ...parsed.data,
        shortDescFr: parsed.data.shortDescFr || null,
        shortDescEn: parsed.data.shortDescEn || null,
      },
      include: { category: true, media: true },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ce slug est déjà utilisé." },
        { status: 409 },
      );
    }

    console.error("Création produit :", error);
    return NextResponse.json({ error: "Création du produit impossible." }, { status: 500 });
  }
}
