import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminOrManager } from "@/lib/admin-api";
import { removeCategoryStorageImage } from "@/lib/category-storage";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authError = await requireAdminOrManager();
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const body = await request.json();

    const existing = await prisma.category.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { message: "Catégorie introuvable." },
        { status: 404 },
      );
    }

    const data: {
      nameFr?: string;
      nameEn?: string;
      slug?: string;
      descriptionFr?: string | null;
      descriptionEn?: string | null;
      coverImage?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    } = {};

    if (typeof body.nameFr === "string") {
      data.nameFr = body.nameFr.trim();
    }

    if (typeof body.nameEn === "string") {
      data.nameEn = body.nameEn.trim();
    }

    if (typeof body.slug === "string") {
      data.slug = slugify(body.slug);
    } else if (typeof body.nameFr === "string" && !existing.slug) {
      data.slug = slugify(body.nameFr);
    }

    if (typeof body.descriptionFr === "string" || body.descriptionFr === null) {
      data.descriptionFr =
        typeof body.descriptionFr === "string"
          ? body.descriptionFr.trim() || null
          : null;
    }

    if (typeof body.descriptionEn === "string" || body.descriptionEn === null) {
      data.descriptionEn =
        typeof body.descriptionEn === "string"
          ? body.descriptionEn.trim() || null
          : null;
    }

    if (typeof body.coverImage === "string" || body.coverImage === null) {
      data.coverImage =
        typeof body.coverImage === "string"
          ? body.coverImage.trim() || null
          : null;
    }

    if (Number.isInteger(body.sortOrder)) {
      data.sortOrder = body.sortOrder;
    }

    if (typeof body.isActive === "boolean") {
      data.isActive = body.isActive;
    }

    if (data.nameFr !== undefined && !data.nameFr) {
      return NextResponse.json(
        { message: "Le nom français est obligatoire." },
        { status: 400 },
      );
    }

    if (data.nameEn !== undefined && !data.nameEn) {
      return NextResponse.json(
        { message: "Le nom anglais est obligatoire." },
        { status: 400 },
      );
    }

    if (data.slug !== undefined && !data.slug) {
      return NextResponse.json(
        { message: "Le slug est obligatoire." },
        { status: 400 },
      );
    }

    const category = await prisma.category.update({
      where: { id },
      data,
      include: {
        _count: { select: { products: true } },
      },
    });

    revalidateTag("public-products", { expire: 0 });
    return NextResponse.json({ category });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "Ce slug existe déjà." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { message: "Impossible de modifier la catégorie." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const authError = await requireAdminOrManager();
  if (authError) return authError;

  try {
    const { id } = await context.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true } },
      },
    });

    if (!category) {
      return NextResponse.json(
        { message: "Catégorie introuvable." },
        { status: 404 },
      );
    }

    if (category._count.products > 0) {
      return NextResponse.json(
        {
          message: `Impossible de supprimer cette catégorie : ${category._count.products} produit(s) y sont associés.`,
        },
        { status: 409 },
      );
    }

    await prisma.category.delete({ where: { id } });
    const warning = await removeCategoryStorageImage(category.coverImage);

    revalidateTag("public-products", { expire: 0 });
    return NextResponse.json({ success: true, warning });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2003") {
      return NextResponse.json(
        { message: "Impossible de supprimer cette catégorie : des produits y sont associés." },
        { status: 409 },
      );
    }
    console.error("Suppression catégorie:", error);
    return NextResponse.json(
      { message: "Impossible de supprimer la catégorie." },
      { status: 500 },
    );
  }
}