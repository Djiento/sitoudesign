import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";
import content from "@/lib/starter-content.json";

export async function POST() {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    await prisma.$transaction(async (transaction) => {
      for (const [index, article] of content.articles.entries()) {
        await transaction.article.upsert({
          where: { slug: article.slug },
          update: {},
          create: {
            ...article,
            coverImage: content.images[index],
            isPublished: true,
            publishedAt: new Date(),
          },
        });
      }
      await transaction.managedContentSection.upsert({
        where: { key: "advice-articles" },
        update: {},
        create: { key: "advice-articles" },
      });
    });

    revalidatePath("/fr/conseils");
    revalidatePath("/en/conseils");
    revalidatePath("/fr/conseils/[slug]", "page");
    revalidatePath("/en/conseils/[slug]", "page");
    const articles = await prisma.article.findMany({ orderBy: [{ updatedAt: "desc" }] });
    return NextResponse.json({ articles });
  } catch (error) {
    console.error("Admin articles import:", error);
    return NextResponse.json({ error: "Impossible d’importer les conseils actuels." }, { status: 500 });
  }
}
