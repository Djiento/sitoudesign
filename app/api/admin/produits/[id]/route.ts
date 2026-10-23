
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/admin-api";

const schema = z.object({
  slug: z.string().trim().min(1).max(150)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nameFr: z.string().trim().min(1).max(200),
  nameEn: z.string().trim().min(1).max(200),
  descriptionFr: z.string().trim().min(1).max(10000),
  descriptionEn: z.string().trim().min(1).max(10000),
  shortDescFr: z.string().trim().max(500).optional(),
  shortDescEn: z.string().trim().max(500).optional(),
  shortDescriptionFr: z.string().trim().max(500).optional(),
  shortDescriptionEn: z.string().trim().max(500).optional(),
  categoryId: z.string().min(1),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  featured: z.boolean(),
  sortOrder: z.number().int().min(0),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  if (staff.role !== "ADMIN" && staff.role !== "MANAGER") {
    return NextResponse.json({ error: "Cette action est réservée aux responsables." }, { status: 403 });
  }
  if (!staff.userId) return NextResponse.json({ error: "Reconnecte-toi pour modifier un produit." }, { status: 401 });

  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Vérifie les champs du produit." }, { status: 400 });
  }

  const category = await prisma.category.findUnique({
    where: { id: parsed.data.categoryId },
  });

  if (!category || !category.isActive) {
    return NextResponse.json({ error: "Catégorie introuvable ou inactive." }, { status: 400 });
  }

  try {
    const product = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.product.update({
        where: { id },
        data: {
          slug: parsed.data.slug,
          nameFr: parsed.data.nameFr,
          nameEn: parsed.data.nameEn,
          descriptionFr: parsed.data.descriptionFr,
          descriptionEn: parsed.data.descriptionEn,
          shortDescFr: parsed.data.shortDescriptionFr ?? parsed.data.shortDescFr ?? null,
          shortDescEn: parsed.data.shortDescriptionEn ?? parsed.data.shortDescEn ?? null,
          categoryId: parsed.data.categoryId,
          status: parsed.data.status,
          featured: parsed.data.featured,
          sortOrder: parsed.data.sortOrder,
        },
        include: { category: true, media: true },
      });
      await transaction.auditEvent.create({
        data: {
          actorId: staff.userId!,
          action: "PRODUCT_UPDATED",
          targetType: "Product",
          targetId: updated.id,
          result: "SUCCESS",
          details: { slug: updated.slug, nameFr: updated.nameFr },
        },
      });
      return updated;
    });

    revalidateTag("public-products", { expire: 0 });
    return NextResponse.json({
      product: {
        ...product,
        shortDescriptionFr: product.shortDescFr,
        shortDescriptionEn: product.shortDescEn,
      },
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
      }
      if (error.code === "P2002") {
        return NextResponse.json({ error: "Ce slug est déjà utilisé." }, { status: 409 });
      }
    }

    console.error("Modification produit :", error);
    return NextResponse.json({ error: "Modification du produit impossible." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { staff, error } = await requireStaff();
  if (error || !staff) return error;
  if (staff.role !== "ADMIN" && staff.role !== "MANAGER") {
    return NextResponse.json({ error: "Cette action est réservée aux responsables." }, { status: 403 });
  }
  if (!staff.userId) return NextResponse.json({ error: "Reconnecte-toi pour supprimer un produit." }, { status: 401 });

  const { id } = await params;

  try {
    await prisma.$transaction(async (transaction) => {
      const product = await transaction.product.delete({ where: { id }, select: { id: true, slug: true, nameFr: true } });
      await transaction.auditEvent.create({
        data: {
          actorId: staff.userId!,
          action: "PRODUCT_DELETED",
          targetType: "Product",
          targetId: product.id,
          result: "SUCCESS",
          details: { slug: product.slug, nameFr: product.nameFr },
        },
      });
    });
    revalidateTag("public-products", { expire: 0 });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
      }
      if (error.code === "P2003") {
        return NextResponse.json({ error: "Ce produit est utilisé par des variantes ou des opérations historiques et ne peut pas être supprimé." }, { status: 409 });
      }
    }

    console.error("Suppression produit :", error);
    return NextResponse.json({ error: "Suppression du produit impossible." }, { status: 500 });
  }
}
