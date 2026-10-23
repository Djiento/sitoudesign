
import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import { managedImageUrl, type ManagedImageType } from "@/lib/managed-image-url";
import ImageGallery from "@/components/gallery/ImageGallery";
import type { GalleryImage } from "@/components/gallery/ImageGallery";

export type PageCard = {
  title: string;
  description: string;
  href?: string;
  media?: boolean;
  category?: string;
  image?: string | null;
  imageType?: ManagedImageType;
  imageSlug?: string;
  images?: GalleryImage[];
};

export default function ContentPage({
  locale,
  eyebrow,
  title,
  description,
  cards,
  sectionTitle,
  sectionDescription,
  ctaTitle,
  ctaDescription,
  mediaCards = false,
  compactIntro = false,
  showCta = true,
  variant = "default",
  afterIntro,
}: {
  locale: Locale;
  eyebrow: string;
  title: string;
  description: string;
  cards?: PageCard[];
  sectionTitle?: string;
  sectionDescription?: string;
  ctaTitle?: string;
  ctaDescription?: string;
  mediaCards?: boolean;
  compactIntro?: boolean;
  showCta?: boolean;
  variant?: string;
  afterIntro?: ReactNode;
}) {
  const en = locale === "en";

  return (
    <div className={`content-page content-page-${variant}`}>
      <section className={`page-hero${compactIntro ? " section-intro" : ""}`}>
        <div className="page-hero-inner">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="hero-actions">
            <Link href={`/${locale}/devis`} className="btn btn-primary">
              {en ? "Request a quote" : "Demander un devis"}
            </Link>
            <Link href={`/${locale}/contact`} className="btn-outline-custom">
              {en ? "Contact us" : "Nous contacter"}
            </Link>
          </div>
        </div>
      </section>

      {afterIntro}

      {cards && cards.length > 0 && (
        <section className="content-section">
          <div className="content-wrap">
            <div className="section-heading">
              <span className="eyebrow">
                {en ? "Sitou Design expertise" : "Le savoir-faire Sitou Design"}
              </span>
              <h2>{sectionTitle}</h2>
              {sectionDescription && <p>{sectionDescription}</p>}
            </div>

            <div className="card-grid">
              {cards.map((card, index) => (
                <article className="service-card" key={`${card.title}-${index}`}>
                  <div className="content-card-topline">
                    <span className="card-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {card.category && (
                      <span className="content-card-category">{card.category}</span>
                    )}
                  </div>
                  {(card.images?.length || card.image) ? (
                    <ImageGallery
                      locale={locale}
                      images={card.images?.length
                        ? card.images.map((image) => ({
                            ...image,
                            src: card.imageType && card.imageSlug
                              ? managedImageUrl(image.src, card.imageType, card.imageSlug) ?? image.src
                              : image.src,
                          }))
                        : [{
                            src: card.imageType && card.imageSlug
                              ? managedImageUrl(card.image!, card.imageType, card.imageSlug) ?? card.image!
                              : card.image!,
                            alt: card.title,
                          }]}
                      className="content-page-card-gallery"
                      imageClassName="content-card-image"
                      displayCount={1}
                    />
                  ) : mediaCards && (
                    <div className="placeholder-media">
                      <strong>
                        {en ? "Your visual goes here" : "Votre visuel ici"}
                      </strong>
                      <span>
                        {en
                          ? "Add your own photo or project image"
                          : "Ajoutez ici votre photo ou votre réalisation"}
                      </span>
                    </div>
                  )}
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                  {card.href && (
                    <Link href={card.href} className="text-link">
                      {en ? "Read more" : "Lire le conseil"} <span aria-hidden="true">↗</span>
                    </Link>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {showCta && (
        <section className="cta-band">
          <div>
            <h2>{ctaTitle ?? (en ? "Have a project in mind?" : "Vous avez un projet en tête ?")}</h2>
            <p>
              {ctaDescription ??
                (en
                  ? "Tell us what you need. We will help you find the right solution."
                  : "Parlez-nous de votre besoin. Nous vous aiderons à trouver la bonne solution.")}
            </p>
          </div>
          <Link href={`/${locale}/devis`} className="btn btn-primary">
            {en ? "Start a project" : "Démarrer un projet"}
          </Link>
        </section>
      )}
    </div>
  );
}
