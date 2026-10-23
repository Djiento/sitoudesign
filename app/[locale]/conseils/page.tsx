
import { notFound } from "next/navigation";
import ContentPage from "@/components/sections/ContentPage";
import { getPageContent } from "@/lib/page-content";
import { isLocale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function ConseilsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const content = getPageContent(raw, "conseils");
  const [articles, managedSection] = await Promise.all([
    prisma.article.findMany({
      where: { isPublished: true },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.managedContentSection.findUnique({ where: { key: "advice-articles" }, select: { key: true } }),
  ]);
  return <ContentPage
    locale={raw}
    variant="insights"
    {...content}
    cards={managedSection
      ? articles.map((article) => ({
        title: raw === "en" ? article.titleEn : article.titleFr,
        description: (raw === "en" ? article.excerptEn : article.excerptFr) ?? "",
        href: `/${raw}/conseils/${article.slug}`,
        category: article.category,
        image: article.coverImage,
        imageType: "article" as const,
        imageSlug: article.slug,
        images: article.coverImage ? [{
          src: article.coverImage,
          alt: raw === "en" ? article.titleEn : article.titleFr,
        }] : [],
      }))
      : content.cards}
  />;
}
