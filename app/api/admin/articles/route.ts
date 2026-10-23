import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";

const articleSchema = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category: z.string().trim().min(2).max(100),
  titleFr: z.string().trim().min(2).max(180),
  titleEn: z.string().trim().min(2).max(180),
  excerptFr: z.string().trim().min(5).max(500),
  excerptEn: z.string().trim().min(5).max(500),
  contentFr: z.string().trim().min(20).max(20000),
  contentEn: z.string().trim().min(20).max(20000),
  coverImage: z.string().trim().url().max(2000).or(z.literal("")).transform((value) => value || null),
  isPublished: z.boolean().default(false),
});

function refreshArticles() {
  revalidatePath("/fr/conseils");
  revalidatePath("/en/conseils");
  revalidatePath("/fr/conseils/[slug]", "page");
  revalidatePath("/en/conseils/[slug]", "page");
}

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const articles = await prisma.article.findMany({
      orderBy: [{ updatedAt: "desc" }],
    });
    return NextResponse.json({ articles });
  } catch (error) {
    console.error("Admin articles GET:", error);
    return NextResponse.json({ error: "Impossible de charger les conseils." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const body: unknown = await request.json().catch(() => null);
  const parsed = articleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Vérifie les champs français et anglais de l’article." }, { status: 400 });
  }

  try {
    const article = await prisma.$transaction(async (transaction) => {
      const created = await transaction.article.create({
        data: {
          ...parsed.data,
          publishedAt: parsed.data.isPublished ? new Date() : null,
        },
      });
      await transaction.managedContentSection.upsert({
        where: { key: "advice-articles" },
        update: {},
        create: { key: "advice-articles" },
      });
      return created;
    });
    refreshArticles();
    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Cet identifiant URL est déjà utilisé." }, { status: 409 });
    }
    console.error("Admin articles POST:", error);
    return NextResponse.json({ error: "Impossible d’enregistrer l’article." }, { status: 500 });
  }
}
