
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/lib/i18n";
import { managedImageUrl } from "@/lib/managed-image-url";
import ImageGallery from "@/components/gallery/ImageGallery";
import { getPublicProduct } from "@/lib/public-page-data";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  if (!isLocale(rawLocale)) return {};

  const product = await getPublicProduct(slug);
  if (!product) return {};

  return {
    title: rawLocale === "en" ? product.nameEn : product.nameFr,
    description: rawLocale === "en" ? product.shortDescEn ?? product.descriptionEn : product.shortDescFr ?? product.descriptionFr,
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { locale: rawLocale, slug } = await params;
  if (!isLocale(rawLocale)) notFound();
  const en = rawLocale === "en";

  const product = await getPublicProduct(slug);

  if (!product) notFound();

  const title = en ? product.nameEn : product.nameFr;
  const description = en ? product.descriptionEn : product.descriptionFr;
  const category = en ? product.category.nameEn : product.category.nameFr;

  return (
    <>
      <section className="page-hero">
        <div className="page-hero-inner">
          <Link className="text-link" href={`/${rawLocale}/catalogue`}>
            ← {en ? "Back to catalogue" : "Retour au catalogue"}
          </Link>
          <p className="eyebrow" style={{ marginTop: 24 }}>{category}</p>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="hero-actions">
            <Link className="btn btn-primary" href={`/${rawLocale}/devis?produit=${encodeURIComponent(product.slug)}`}>
              {en ? "Request a quote" : "Demander un devis"}
            </Link>
          </div>
        </div>
      </section>
      <section className="content-section">
        <div className="content-wrap">
          <div className="card-grid">
            {product.media.length > 0 ? (
              <ImageGallery
                locale={rawLocale}
                className="product-detail-gallery"
                imageClassName="product-detail-gallery-image"
                images={product.media.map((media) => ({
                  src: managedImageUrl(media.url, "product", product.slug) ?? media.url,
                  alt: (en ? media.altEn : media.altFr) || title,
                }))}
              />
            ) : (
              <div className="placeholder-media">
                <strong>{en ? "Your product photo" : "Photo de ce produit"}</strong>
                <span>{en ? "Add your own media in the admin panel." : "Ajoute ton propre visuel dans l'administration."}</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
