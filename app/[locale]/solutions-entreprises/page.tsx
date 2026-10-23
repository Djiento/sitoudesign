
import { notFound } from "next/navigation";
import ContentPage from "@/components/sections/ContentPage";
import { getPageContent } from "@/lib/page-content";
import { isLocale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function BusinessSolutionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const content = getPageContent(raw, "solutions-entreprises");
  const [solutions, managedSection] = await Promise.all([
    prisma.businessSolution.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.managedContentSection.findUnique({ where: { key: "business-solutions" }, select: { key: true } }),
  ]);
  return <ContentPage
    locale={raw}
    variant="business"
    {...content}
    cards={managedSection
      ? solutions.map((solution) => ({
        title: raw === "en" ? solution.titleEn : solution.titleFr,
        description: raw === "en" ? solution.descriptionEn : solution.descriptionFr,
        image: solution.coverImage,
        imageType: "business-solution" as const,
        imageSlug: solution.slug,
        href: `/${raw}/devis?solution=${encodeURIComponent(solution.slug)}`,
      }))
      : content.cards}
  />;
}
