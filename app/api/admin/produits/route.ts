import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminOrManager, requireStaff } from "@/lib/admin-api";

const productSchema = z.object({
  slug: z.string().trim().min(1).max(150).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nameFr: z.string().trim().min(1).max(200),
  nameEn: z.string().trim().min(1).max(200),
  descriptionFr: z.string().trim().min(1).max(10000),
  descriptionEn: z.string().trim().min(1).max(10000),
  shortDescriptionFr: z.string().trim().max(500).optional(),
  shortDescriptionEn: z.string().trim().max(500).optional(),
  categoryId: z.string().min(1),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
});

export async function GET() {
  const authError = await requireAdminOrManager();
  if (authError) return authError;

  try {
    const products = await prisma.product.findMany({
      include: {
        category: true,
        media: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({
      products: products.map((product) => ({
        ...product,
        shortDescriptionFr: product.shortDescFr,
        shortDescriptionEn: product.shortDescEn,
      })),
    });
  } catch (error) {
    console.error("Admin products GET:", error);
    return NextResponse.json(
      { error: "Impossible de charger les produits." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  if (staff.role !== "ADMIN" && staff.role !== "MANAGER") {
    return NextResponse.json({ error: "Cette action est réservée aux responsables." }, { status: 403 });
  }
  if (!staff.userId) return NextResponse.json({ error: "Reconnecte-toi pour créer un produit." }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Vérifie les champs obligatoires du produit." },
      { status: 400 },
    );
  }

  const category = await prisma.category.findUnique({
    where: { id: parsed.data.categoryId },
    select: { id: true, isActive: true },
  });
  if (!category || !category.isActive) {
    return NextResponse.json(
      { error: "Catégorie introuvable ou inactive." },
      { status: 400 },
    );
  }

  try {
    const product = await prisma.$transaction(async (transaction) => {
      const created = await transaction.product.create({
        data: {
          slug: parsed.data.slug,
          nameFr: parsed.data.nameFr,
          nameEn: parsed.data.nameEn,
          descriptionFr: parsed.data.descriptionFr,
          descriptionEn: parsed.data.descriptionEn,
          shortDescFr: parsed.data.shortDescriptionFr || null,
          shortDescEn: parsed.data.shortDescriptionEn || null,
          categoryId: parsed.data.categoryId,
          status: parsed.data.status,
          featured: parsed.data.featured,
          sortOrder: parsed.data.sortOrder,
        },
        include: {
          category: true,
          media: { orderBy: { sortOrder: "asc" } },
        },
      });
      await transaction.auditEvent.create({
        data: {
          actorId: staff.userId!,
          action: "PRODUCT_CREATED",
          targetType: "Product",
          targetId: created.id,
          result: "SUCCESS",
          details: { slug: created.slug, nameFr: created.nameFr },
        },
      });
      return created;
    });

    revalidateTag("public-products", { expire: 0 });
    return NextResponse.json({
      product: {
        ...product,
        shortDescriptionFr: product.shortDescFr,
        shortDescriptionEn: product.shortDescEn,
      },
    }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Ce slug est déjà utilisé." }, { status: 409 });
    }
    console.error("Admin products POST:", error);
    return NextResponse.json(
      { error: "Impossible de créer le produit." },
      { status: 500 },
    );
  }
}
