
import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/lib/i18n";
import { getPublicPortfolioProject } from "@/lib/public-page-data";
import { managedImageUrl } from "@/lib/managed-image-url";
import ImageGallery from "@/components/gallery/ImageGallery";

export default async function PortfolioDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  if (!isLocale(rawLocale)) notFound();
  const en = rawLocale === "en";

  const project = await getPublicPortfolioProject(slug);

  if (!project) notFound();

  const title = en ? project.titleEn : project.titleFr;
  const description = en ? project.descriptionEn : project.descriptionFr;
  const images = [
    ...project.gallery.map((media) => ({
      id: media.id,
      url: `/api/portfolio/media/${media.id}`,
      alt: (en ? media.altEn : media.altFr) || title,
    })),
    ...(project.coverImage &&
    !project.gallery.some((media) => media.url === project.coverImage)
      ? [{ id: "cover", url: managedImageUrl(project.coverImage, "portfolio", project.slug) ?? project.coverImage, alt: title }]
      : []),
  ];

  return (
    <>
      <section className="page-hero">
        <div className="page-hero-inner">
          <Link className="text-link" href={`/${rawLocale}/realisations`}>
            ← {en ? "Back to portfolio" : "Retour aux réalisations"}
          </Link>
          <span className="eyebrow" style={{ marginTop: 24 }}>
            {project.category || (en ? "Project" : "Réalisation")}
          </span>
          <h1>{title}</h1>
          <p>{description}</p>
          {project.clientName && <p>{en ? "Client" : "Client"} : {project.clientName}</p>}
        </div>
      </section>
      <section className="content-section">
        <div className="content-wrap">
          <div className="card-grid">
            {images.length ? (
              <ImageGallery
                locale={rawLocale}
                className="portfolio-detail-gallery"
                itemClassName="portfolio-detail-image"
                images={images.map((image) => ({
                  src: image.id === "cover" ? image.url : `/api/portfolio/media/${image.id}`,
                  alt: image.alt,
                }))}
              />
            ) : (
              <div className="placeholder-media">
                <strong>{en ? "Project gallery" : "Galerie du projet"}</strong>
                <span>{en ? "Your uploaded project images will appear here." : "Les images que tu ajoutes apparaîtront ici."}</span>
              </div>
            )}
          </div>
          <div className="hero-actions">
            <Link href={`/${rawLocale}/devis`} className="btn btn-primary">
              {en ? "Start a similar project" : "Demander un projet similaire"}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
