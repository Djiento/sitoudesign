
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const locale = params.get("locale") === "en" ? "en" : "fr";
  const categorySlug = params.get("category");
  const search = params.get("q")?.trim();

  try {
    const products = await prisma.product.findMany({
      where: {
        status: "PUBLISHED",
        ...(categorySlug ? { category: { slug: categorySlug, isActive: true } } : {}),
        ...(search
          ? {
              OR: [
                { nameFr: { contains: search, mode: "insensitive" } },
                { nameEn: { contains: search, mode: "insensitive" } },
                { descriptionFr: { contains: search, mode: "insensitive" } },
                { descriptionEn: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        category: true,
        media: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
      orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      take: 100,
    });

    return NextResponse.json({
      products: products.map((product) => ({
        id: product.id,
        slug: product.slug,
        name: locale === "en" ? product.nameEn : product.nameFr,
        description: locale === "en" ? product.shortDescEn ?? product.descriptionEn : product.shortDescFr ?? product.descriptionFr,
        featured: product.featured,
        category: {
          slug: product.category.slug,
          name: locale === "en" ? product.category.nameEn : product.category.nameFr,
        },
        image: product.media[0]?.url ?? null,
      })),
    });
  } catch (error) {
    console.error("Catalogue API error:", error);
    return NextResponse.json(
      { error: "CATALOGUE_UNAVAILABLE" },
      { status: 500 },
    );
  }
}
