
import type { Locale } from "@/lib/i18n";
import type { PageCard } from "@/components/sections/ContentPage";
import { getInsights } from "@/lib/insights";

type ContentDefinition = {
  eyebrow: string;
  title: string;
  description: string;
  sectionTitle: string;
  sectionDescription: string;
  cards: PageCard[];
};

const content: Record<Locale, Record<string, ContentDefinition>> = {
  fr: {
    catalogue: {
      eyebrow: "Le catalogue Sitou Design",
      title: "Les bons supports pour faire rayonner votre marque.",
      description: "Explorez nos familles de produits et trouvez les solutions adaptées à votre communication.",
      sectionTitle: "Toutes nos catégories",
      sectionDescription: "Les fiches produits et les photos seront complétées avec tes propres contenus.",
      cards: [
        { title: "Impression", description: "Cartes de visite, flyers, brochures, dépliants et affiches.", href: "/fr/catalogue/impression" },
        { title: "Signalétique", description: "Enseignes, panneaux, vitrines et supports grand format.", href: "/fr/catalogue/signaletique" },
        { title: "Textile", description: "T-shirts, polos, tenues d'équipe et textiles personnalisés.", href: "/fr/catalogue/textile" },
        { title: "Objets personnalisés", description: "Objets promotionnels, cadeaux d'affaires et accessoires.", href: "/fr/catalogue/objets-personnalises" },
        { title: "Création graphique", description: "Logos, identité visuelle, mise en page et supports publicitaires.", href: "/fr/catalogue/creation-graphique" },
        { title: "Web", description: "Sites vitrines et solutions digitales pour votre activité.", href: "/fr/catalogue/web" },
      ],
    },
    realisations: {
      eyebrow: "Portfolio",
      title: "Des idées concrétisées par notre savoir-faire.",
      description: "Retrouve ici les projets réalisés par Sitou Design, classés par type de prestation et par secteur.",
      sectionTitle: "Nos réalisations",
      sectionDescription: "Découvrez les projets publiés par Sitou Design.",
      cards: [
        { title: "Identité & impression", description: "Présente ici tes créations graphiques, cartes et supports imprimés.", media: true },
        { title: "Signalétique & enseignes", description: "Ajoute tes photos d'enseignes, de vitrines et de supports grand format.", media: true },
        { title: "Textile & objets", description: "Montre tes textiles, cadeaux et objets personnalisés.", media: true },
      ],
    },
    services: {
      eyebrow: "Nos services",
      title: "De la conception à la réalisation, un accompagnement complet.",
      description: "Nous t'accompagnons dans le choix des supports, la création graphique, la production et la préparation de tes projets.",
      sectionTitle: "Comment nous pouvons vous aider",
      sectionDescription: "Une approche flexible, selon les besoins et le budget de chaque projet.",
      cards: [
        { title: "Conseil & préparation", description: "Choix du support, du format, des finitions et préparation des fichiers." },
        { title: "Création graphique", description: "Conception ou adaptation de visuels pour une communication cohérente." },
        { title: "Production", description: "Coordination de la réalisation des supports selon les spécifications validées." },
      ],
    },
    "solutions-entreprises": {
      eyebrow: "Solutions entreprises",
      title: "Une communication cohérente à chaque point de contact.",
      description: "Des supports coordonnés pour les entreprises, commerces, associations et organisateurs d'événements.",
      sectionTitle: "Des solutions adaptées à votre organisation",
      sectionDescription: "Regroupe tes besoins et demande une proposition adaptée à tes objectifs.",
      cards: [
        { title: "Identité de marque", description: "Une image cohérente sur tes documents, enseignes et supports de communication." },
        { title: "Communication commerciale", description: "Des supports pour présenter tes offres, tes services et tes événements." },
        { title: "Équipements & événements", description: "Textiles personnalisés, badges, signalétique et supports événementiels." },
      ],
    },
    conseils: {
      eyebrow: "Conseils & inspirations",
      title: "Des idées utiles pour mieux préparer vos projets.",
      description: "Des articles pratiques pour choisir les formats, les supports et les finitions de vos communications.",
      sectionTitle: "Nos conseils",
      sectionDescription: "Cette rubrique sera alimentée avec tes propres articles et recommandations.",
      cards: [
        { title: "Bien préparer un fichier pour l'impression", description: "Les points essentiels à vérifier avant d'envoyer un document en production.", href: "/fr/conseils/preparer-fichier-impression" },
        { title: "Choisir le bon support publicitaire", description: "Comment adapter le support à l'objectif et au public visé.", href: "/fr/conseils/choisir-support-publicitaire" },
        { title: "Créer une image de marque cohérente", description: "Quelques principes pour garder une identité reconnaissable.", href: "/fr/conseils/image-de-marque" },
      ],
    },
  },
  en: {
    catalogue: {
      eyebrow: "The Sitou Design catalogue",
      title: "The right materials to make your brand stand out.",
      description: "Explore our product categories and find solutions for your communication needs.",
      sectionTitle: "Browse our categories",
      sectionDescription: "Product details and photos can be completed with your own content.",
      cards: [
        { title: "Printing", description: "Business cards, flyers, brochures, leaflets and posters.", href: "/en/catalogue/impression" },
        { title: "Signage", description: "Signs, panels, window graphics and large-format displays.", href: "/en/catalogue/signaletique" },
        { title: "Textiles", description: "T-shirts, polos, teamwear and personalised textiles.", href: "/en/catalogue/textile" },
        { title: "Custom products", description: "Promotional products, corporate gifts and accessories.", href: "/en/catalogue/objets-personnalises" },
        { title: "Graphic design", description: "Logos, visual identity, layouts and advertising materials.", href: "/en/catalogue/creation-graphique" },
        { title: "Web", description: "Business websites and digital solutions.", href: "/en/catalogue/web" },
      ],
    },
    realisations: {
      eyebrow: "Portfolio",
      title: "Ideas brought to life through our expertise.",
      description: "Explore Sitou Design projects by service type and industry.",
      sectionTitle: "Our work",
      sectionDescription: "Explore projects published by Sitou Design.",
      cards: [
        { title: "Branding & print", description: "Add your graphic design, business card and print projects.", media: true },
        { title: "Signage", description: "Add your signs, window graphics and large-format work.", media: true },
        { title: "Textiles & products", description: "Showcase your personalised textiles and branded products.", media: true },
      ],
    },
    services: {
      eyebrow: "Our services",
      title: "From concept to production, support at every step.",
      description: "We help you choose the right materials, prepare designs and organise your project.",
      sectionTitle: "How we can help",
      sectionDescription: "Flexible support for projects of different sizes and budgets.",
      cards: [
        { title: "Advice & preparation", description: "Material, format, finishing and artwork preparation." },
        { title: "Graphic design", description: "Create or adapt visuals for consistent communication." },
        { title: "Production", description: "Coordinate production according to approved specifications." },
      ],
    },
    "solutions-entreprises": {
      eyebrow: "Business solutions",
      title: "Consistent communication at every touchpoint.",
      description: "Coordinated materials for companies, shops, associations and event organisers.",
      sectionTitle: "Solutions for your organisation",
      sectionDescription: "Bring your needs together and request a tailored proposal.",
      cards: [
        { title: "Brand identity", description: "A consistent image across documents, signage and communication." },
        { title: "Commercial communication", description: "Materials to present your offers, services and events." },
        { title: "Events & teamwear", description: "Custom textiles, badges, signage and event materials." },
      ],
    },
    conseils: {
      eyebrow: "Tips & inspiration",
      title: "Useful ideas to prepare your next project.",
      description: "Practical articles about formats, materials and print finishes.",
      sectionTitle: "Our insights",
      sectionDescription: "This section will be filled with your own articles and recommendations.",
      cards: [
        { title: "Preparing artwork for print", description: "Key checks before sending a document to production." },
        { title: "Choosing the right advertising material", description: "Match your material to your goal and audience." },
        { title: "Building a consistent brand", description: "Principles for a recognisable visual identity." },
      ],
    },
  },
};

export function getPageContent(locale: Locale, key: string) {
  const definition = content[locale][key] ?? content.fr.catalogue;

  if (key !== "conseils") return definition;

  return {
    ...definition,
    sectionTitle: locale === "en" ? "Practical guides" : "Guides pratiques",
    sectionDescription:
      locale === "en"
        ? "Ten useful guides to help you plan your next print, design or communication project."
        : "Dix guides concrets pour mieux préparer vos projets d’impression, de design et de communication.",
    cards: getInsights(locale).map((insight): PageCard => ({
      title: insight.title,
      description: insight.excerpt,
      href: `/${locale}/conseils/${insight.slug}`,
      category: insight.category,
    })),
  };
}
