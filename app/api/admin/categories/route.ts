import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminOrManager } from "@/lib/admin-api";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET() {
  const authError = await requireAdminOrManager();
  if (authError) return authError;

  try {
    const categories = await prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { products: true } },
      },
    });

    return NextResponse.json({ categories });
  } catch {
    return NextResponse.json(
      { message: "Impossible de charger les catégories." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminOrManager();
  if (authError) return authError;

  try {
    const body = await request.json();

    const nameFr =
      typeof body.nameFr === "string" ? body.nameFr.trim() : "";
    const nameEn =
      typeof body.nameEn === "string" ? body.nameEn.trim() : "";
    const slug =
      typeof body.slug === "string" && body.slug.trim()
        ? slugify(body.slug)
        : slugify(nameFr);

    if (!nameFr || !nameEn || !slug) {
      return NextResponse.json(
        { message: "Les noms français, anglais et le slug sont obligatoires." },
        { status: 400 },
      );
    }

    const category = await prisma.category.create({
      data: {
        nameFr,
        nameEn,
        slug,
        descriptionFr:
          typeof body.descriptionFr === "string"
            ? body.descriptionFr.trim() || null
            : null,
        descriptionEn:
          typeof body.descriptionEn === "string"
            ? body.descriptionEn.trim() || null
            : null,
        coverImage:
          typeof body.coverImage === "string"
            ? body.coverImage.trim() || null
            : null,
        sortOrder: Number.isInteger(body.sortOrder)
          ? body.sortOrder
          : 0,
        isActive: typeof body.isActive === "boolean" ? body.isActive : true,
      },
      include: {
        _count: { select: { products: true } },
      },
    });

    revalidateTag("public-products", { expire: 0 });
    return NextResponse.json({ category }, { status: 201 });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "Ce slug existe déjà. Choisis-en un autre." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { message: "Impossible de créer la catégorie." },
      { status: 500 },
    );
  }
}