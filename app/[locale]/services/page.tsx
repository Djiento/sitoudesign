
import { notFound } from "next/navigation";
import ContentPage from "@/components/sections/ContentPage";
import { getPageContent } from "@/lib/page-content";
import { isLocale } from "@/lib/i18n";
import { getPublicServices } from "@/lib/public-page-data";
import Link from "next/link";
import catalogue from "@/lib/service-catalogue.json";
import { managedImageUrl } from "@/lib/managed-image-url";
import ImageGallery from "@/components/gallery/ImageGallery";

export const instant = false;

export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const services = await getPublicServices();
  const content = getPageContent(raw, "services");
  if (!services.length) {
    return <ContentPage locale={raw} variant="services" {...content} cards={content.cards} />;
  }
  const groups = catalogue.categories.map((category) => ({
    ...category,
    services: services.filter((service) => service.serviceCategory === category.key),
  })).filter((category) => category.services.length > 0);
  const uncategorized = services.filter((service) => !catalogue.categories.some((category) => category.key === service.serviceCategory));
  if (uncategorized.length) {
    groups.push({
      ...catalogue.categories[catalogue.categories.length - 1],
      key: "autres-prestations",
      titleFr: "Autres prestations",
      titleEn: "Other services",
      descriptionFr: "Découvrez également nos prestations complémentaires.",
      descriptionEn: "Explore our additional services.",
      services: uncategorized,
    });
  }

  return <ContentPage
    locale={raw}
    variant="services"
    {...content}
    cards={[]}
    afterIntro={
      <section className="content-section service-catalogue">
        <div className="content-wrap">
          <nav className="service-category-nav" aria-label={raw === "fr" ? "Catégories de services" : "Service categories"}>
            {groups.map((group) => <a key={group.key} href={`#${group.key}`}>{raw === "fr" ? group.titleFr : group.titleEn}<span>{group.services.length}</span></a>)}
          </nav>
          {groups.map((group, categoryIndex) => (
            <section className="service-category-section" id={group.key} key={group.key}>
              <div className="section-heading">
                <span className="eyebrow">{String(categoryIndex + 1).padStart(2, "0")} · {raw === "fr" ? "Catégorie de services" : "Service category"}</span>
                <h2>{raw === "fr" ? group.titleFr : group.titleEn}</h2>
                <p>{raw === "fr" ? group.descriptionFr : group.descriptionEn}</p>
              </div>
              <div className="card-grid">
                {group.services.map((service) => (
                  <article className="service-card service-catalogue-card" key={service.id}>
                    {service.coverImage
                      ? <ImageGallery locale={raw} images={[{ src: managedImageUrl(service.coverImage, "service", service.slug) ?? service.coverImage, alt: raw === "fr" ? service.titleFr : service.titleEn }]} className="content-page-card-gallery" imageClassName="content-card-image" />
                      : <div className="placeholder-media"><strong>{raw === "fr" ? service.titleFr : service.titleEn}</strong><span>{raw === "fr" ? "Ajoutez votre photo depuis l’administration" : "Add your photo from the admin panel"}</span></div>}
                    <h3>{raw === "fr" ? service.titleFr : service.titleEn}</h3>
                    <p>{raw === "fr" ? service.descriptionFr : service.descriptionEn}</p>
                    <Link href={`/${raw}/services/${service.slug}`} className="text-link">{raw === "fr" ? "Découvrir la prestation" : "Explore this service"} <span aria-hidden="true">↗</span></Link>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    }
  />;
}
