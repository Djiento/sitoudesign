import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";

type RouteContext = { params: Promise<{ id: string }> };

const articleUpdateSchema = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  category: z.string().trim().min(2).max(100).optional(),
  titleFr: z.string().trim().min(2).max(180).optional(),
  titleEn: z.string().trim().min(2).max(180).optional(),
  excerptFr: z.string().trim().min(5).max(500).optional(),
  excerptEn: z.string().trim().min(5).max(500).optional(),
  contentFr: z.string().trim().min(20).max(20000).optional(),
  contentEn: z.string().trim().min(20).max(20000).optional(),
  coverImage: z.string().trim().url().max(2000).or(z.literal("")).transform((value) => value || null).optional(),
  isPublished: z.boolean().optional(),
});

function refreshArticles() {
  revalidatePath("/fr/conseils");
  revalidatePath("/en/conseils");
  revalidatePath("/fr/conseils/[slug]", "page");
  revalidatePath("/en/conseils/[slug]", "page");
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const body: unknown = await request.json().catch(() => null);
  const parsed = articleUpdateSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    return NextResponse.json({ error: "Aucune modification valide à enregistrer." }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const article = await prisma.$transaction(async (transaction) => {
      const current = await transaction.article.findUnique({ where: { id }, select: { publishedAt: true } });
      if (!current) return null;
      const updated = await transaction.article.update({
        where: { id },
        data: {
          ...parsed.data,
          ...(parsed.data.isPublished === true && !current.publishedAt ? { publishedAt: new Date() } : {}),
          ...(parsed.data.isPublished === false ? { publishedAt: null } : {}),
        },
      });
      await transaction.managedContentSection.upsert({
        where: { key: "advice-articles" },
        update: {},
        create: { key: "advice-articles" },
      });
      return updated;
    });
    if (!article) return NextResponse.json({ error: "Article introuvable." }, { status: 404 });
    refreshArticles();
    return NextResponse.json({ article });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error) {
      if (error.code === "P2025") return NextResponse.json({ error: "Article introuvable." }, { status: 404 });
      if (error.code === "P2002") return NextResponse.json({ error: "Cet identifiant URL est déjà utilisé." }, { status: 409 });
    }
    console.error("Admin articles PATCH:", error);
    return NextResponse.json({ error: "Impossible de modifier l’article." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const { id } = await context.params;
    await prisma.$transaction(async (transaction) => {
      await transaction.article.delete({ where: { id } });
      await transaction.managedContentSection.upsert({
        where: { key: "advice-articles" },
        update: {},
        create: { key: "advice-articles" },
      });
    });
    refreshArticles();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Article introuvable." }, { status: 404 });
    }
    console.error("Admin articles DELETE:", error);
    return NextResponse.json({ error: "Impossible de supprimer l’article." }, { status: 500 });
  }
}
