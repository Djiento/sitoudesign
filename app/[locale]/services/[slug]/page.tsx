import Link from "next/link";
import { notFound } from "next/navigation";
import catalogue from "@/lib/service-catalogue.json";
import { isLocale } from "@/lib/i18n";
import { managedImageUrl } from "@/lib/managed-image-url";
import ImageGallery from "@/components/gallery/ImageGallery";
import { getPublicService } from "@/lib/public-page-data";

export const instant = false;

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  if (!isLocale(rawLocale)) notFound();
  const service = await getPublicService(slug);
  if (!service) notFound();
  const en = rawLocale === "en";
  const category = catalogue.categories.find((item) => item.key === service.serviceCategory);
  const categoryTitle = category ? en ? category.titleEn : category.titleFr : en ? "Our services" : "Nos services";
  const serviceTitle = en ? service.titleEn : service.titleFr;
  const examples = [
    en ? `${serviceTitle} for a local business` : `${serviceTitle} pour un commerce local`,
    en ? `${serviceTitle} for a product launch` : `${serviceTitle} pour un lancement de produit`,
    en ? `${serviceTitle} for a professional event` : `${serviceTitle} pour un événement professionnel`,
  ];

  return (
    <div className="service-detail-page">
      <section className="page-hero service-detail-hero">
        <div className="page-hero-inner">
          <Link href={`/${rawLocale}/services`} className="service-detail-back">{en ? "← All services" : "← Tous les services"}</Link>
          <span className="eyebrow">{categoryTitle}</span>
          <h1>{en ? service.titleEn : service.titleFr}</h1>
          <p>{en ? service.descriptionEn : service.descriptionFr}</p>
          <div className="hero-actions">
            <Link href={`/${rawLocale}/devis?service=${encodeURIComponent(service.slug)}`} className="btn btn-primary">{en ? "Request a quote" : "Demander un devis"}</Link>
            <Link href={`/${rawLocale}/contact`} className="btn-outline-custom">{en ? "Ask us a question" : "Nous poser une question"}</Link>
          </div>
        </div>
      </section>

      <section className="content-section service-detail-content">
        <div className="content-wrap">
          <div className="service-detail-layout">
            <div>
              <span className="eyebrow">{en ? "A tailored service" : "Une prestation adaptée"}</span>
              <h2>{en ? "Made to fit your project" : "Pensée pour votre projet"}</h2>
              <p>{en
                ? `We prepare ${service.titleEn.toLowerCase()} around your goals, formats and brand guidelines. The details are confirmed with you before production, so the final result fits the way you plan to use it.`
                : `Pour votre projet, nous adaptons cette prestation à vos objectifs, vos formats et votre identité. Les détails sont validés avec vous avant la réalisation afin que le résultat corresponde à l’usage prévu.`}</p>
            </div>
            {service.coverImage
                ? <ImageGallery locale={rawLocale} images={[{ src: managedImageUrl(service.coverImage, "service", service.slug) ?? service.coverImage, alt: en ? service.titleEn : service.titleFr }]} className="service-detail-image-gallery" imageClassName="service-detail-image" />
              : <div className="service-detail-image service-detail-image-placeholder"><span>{en ? "Your project photo" : "La photo de votre réalisation"}</span><small>{en ? "Replace this visual from the admin service editor." : "Remplacez ce visuel depuis la fiche service de l’administration."}</small></div>}
          </div>
        </div>
      </section>

      <section className="content-section service-detail-examples">
        <div className="content-wrap">
          <div className="section-heading">
            <span className="eyebrow">{en ? "Ideas for your project" : "Des idées pour votre projet"}</span>
            <h2>{en ? "Possible project examples" : "Exemples de réalisations possibles"}</h2>
            <p>{en
              ? "These are illustrative project ideas, not a record of completed client work."
              : "Ces propositions sont des exemples d’application, et non des références de projets clients déjà réalisés."}</p>
          </div>
          <div className="service-example-grid">
            {examples.map((example, index) => (
              <article className="service-example-card" key={example}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{example}</h3>
                <p>{en
                  ? `An illustrative use of our ${service.titleEn.toLowerCase()} service.`
                  : `Une proposition d’application pour notre prestation « ${service.titleFr.toLowerCase()} ».`}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div>
          <h2>{en ? "Let’s discuss your project" : "Parlons de votre projet"}</h2>
          <p>{en ? "Tell us what you need and receive a proposal tailored to your project." : "Expliquez-nous votre besoin pour recevoir une proposition adaptée."}</p>
        </div>
        <Link href={`/${rawLocale}/devis?service=${encodeURIComponent(service.slug)}`} className="btn btn-primary">{en ? "Request a quote" : "Demander un devis"}</Link>
      </section>
    </div>
  );
}
