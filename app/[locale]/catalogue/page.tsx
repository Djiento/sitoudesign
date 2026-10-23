
import { notFound } from "next/navigation";
import ContentPage from "@/components/sections/ContentPage";
import { getPageContent } from "@/lib/page-content";
import { isLocale } from "@/lib/i18n";
import { getPublicProducts } from "@/lib/public-page-data";

export const instant = false;

export default async function CataloguePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const data = getPageContent(raw, "catalogue");
  const products = await getPublicProducts();
  const cards = products.length
    ? products.map((product) => ({
        title: raw === "fr" ? product.nameFr : product.nameEn,
        description: raw === "fr" ? product.shortDescFr ?? product.descriptionFr : product.shortDescEn ?? product.descriptionEn,
        href: `/${raw}/catalogue/${product.slug}`,
        category: raw === "fr" ? product.category.nameFr : product.category.nameEn,
        image: product.media[0]?.url ?? null,
        imageType: "product" as const,
        imageSlug: product.slug,
        images: product.media.map((media) => ({
          src: media.url,
          alt: (raw === "fr" ? media.altFr : media.altEn) || (raw === "fr" ? product.nameFr : product.nameEn),
        })),
      }))
    : data.cards;

  return <ContentPage
    locale={raw}
    variant="catalogue"
    {...data}
    sectionTitle={raw === "fr" ? "15 idées pour votre marque" : "15 ideas for your brand"}
    sectionDescription={raw === "fr" ? "Parcourez les produits et supports personnalisables. Chaque fiche et chaque image peuvent être remplacées depuis votre espace de gestion." : "Browse customisable products and materials. Each listing and image can be updated from your management area."}
    cards={cards}
  />;
}