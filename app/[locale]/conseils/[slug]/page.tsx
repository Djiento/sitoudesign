
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isLocale } from "@/lib/i18n";
import { managedImageUrl } from "@/lib/managed-image-url";
import { getInsight } from "@/lib/insights";
import ImageGallery from "@/components/gallery/ImageGallery";

export const instant = false;

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  if (!isLocale(rawLocale)) notFound();
  const en = rawLocale === "en";
  const article = await prisma.article.findFirst({ where: { slug, isPublished: true } });

  if (!article) {
    const managedSection = await prisma.managedContentSection.findUnique({
      where: { key: "advice-articles" },
      select: { key: true },
    });
    if (managedSection) notFound();
    const insight = getInsight(rawLocale, slug);
    if (!insight) notFound();
    return (
      <article className="insight-detail">
        <section className="page-hero">
          <div className="page-hero-inner">
            <Link href={`/${rawLocale}/conseils`} className="text-link">
              ← {en ? "Back to insights" : "Retour aux conseils"}
            </Link>
            <span className="eyebrow insight-detail-category">{insight.category}</span>
            <h1>{insight.title}</h1>
            <p>{insight.excerpt}</p>
          </div>
        </section>
        <section className="content-section insight-article-section">
          <div className="insight-article">
            <p className="insight-article-lead">{insight.excerpt}</p>
            {insight.sections.map((section, index) => (
              <p key={`${slug}-${index}`}>{section}</p>
            ))}
            <Link href={`/${rawLocale}/conseils`} className="text-link">
              ← {en ? "Explore all guides" : "Voir tous les conseils"}
            </Link>
          </div>
        </section>
      </article>
    );
  }

  return (
    <article className="insight-detail">
      <section className="page-hero">
        <div className="page-hero-inner">
          <Link href={`/${rawLocale}/conseils`} className="text-link">
            ← {en ? "Back to insights" : "Retour aux conseils"}
          </Link>
          <span className="eyebrow insight-detail-category">{article.category}</span>
          <h1>{en ? article.titleEn : article.titleFr}</h1>
          <p>{en ? article.excerptEn : article.excerptFr}</p>
        </div>
      </section>
      <section className="content-section insight-article-section">
        <div className="insight-article">
          {article.coverImage && (
            <ImageGallery
              locale={rawLocale}
              images={[{
                src: managedImageUrl(article.coverImage, "article", article.slug) ?? article.coverImage,
                alt: en ? article.titleEn : article.titleFr,
              }]}
              className="insight-cover-gallery"
              imageClassName="insight-cover-image"
            />
          )}
          <div className="insight-article-copy">
            {(en ? article.contentEn : article.contentFr).split(/\n\s*\n/).map((paragraph, index) => (
              <p key={`${article.id}-${index}`}>{paragraph}</p>
            ))}
          </div>
          <Link href={`/${rawLocale}/conseils`} className="text-link">
            ← {en ? "Explore all guides" : "Voir tous les conseils"}
          </Link>
        </div>
      </section>
    </article>
  );
}