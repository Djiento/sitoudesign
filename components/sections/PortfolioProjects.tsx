import Link from "next/link";
import { managedImageUrl } from "@/lib/managed-image-url";
import type { Locale } from "@/lib/i18n";
import { getPublicPortfolioProjects } from "@/lib/public-page-data";
import ImageGallery from "@/components/gallery/ImageGallery";

export default async function PortfolioProjects({
  locale,
  limit,
}: {
  locale: Locale;
  limit?: number;
}) {
  const en = locale === "en";
  const projects = await getPublicPortfolioProjects(limit);

  if (projects.length === 0) {
    return (
      <p className="portfolio-empty">
        {en
          ? "Published projects will appear here soon."
          : "Les réalisations publiées apparaîtront ici bientôt."}
      </p>
    );
  }

  return (
    <div className="portfolio-project-grid">
      {projects.map((project) => {
        const title = en ? project.titleEn : project.titleFr;
        const description = en
          ? project.descriptionEn
          : project.descriptionFr;
        const images = [
          ...project.gallery.map((media) => ({
            src: `/api/portfolio/media/${media.id}`,
            alt: (en ? media.altEn : media.altFr) || title,
          })),
          ...(project.coverImage &&
          !project.gallery.some((media) => media.url === project.coverImage)
            ? [{
                src: managedImageUrl(project.coverImage, "portfolio", project.slug) ?? project.coverImage,
                alt: title,
              }]
            : []),
        ];

        return (
          <article
            className="portfolio-project-card"
            key={project.slug}
          >
            <Link
              href={`/${locale}/realisations/${project.slug}`}
              className="portfolio-project-link-overlay"
              aria-label={en ? `View ${title}` : `Voir la réalisation : ${title}`}
              tabIndex={-1}
            />
            <div className="portfolio-project-image">
              {images.length ? (
                <ImageGallery
                  images={images}
                  locale={locale}
                  className="portfolio-project-image-gallery"
                  imageClassName="portfolio-project-card-image"
                  displayCount={1}
                />
              ) : (
                <span>{en ? "Project image" : "Visuel du projet"}</span>
              )}
            </div>
            <div className="portfolio-project-copy">
              {project.category && (
                <span className="portfolio-project-category">
                  {project.category}
                </span>
              )}
              <h3>{title}</h3>
              <p>{description}</p>
              <Link href={`/${locale}/realisations/${project.slug}`} className="portfolio-project-link">
                {en ? "View project" : "Voir la réalisation"} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
