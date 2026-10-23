import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const projects = [
  {
    slug: "identite-visuelle-marque-de-cafe",
    titleFr: "Identité visuelle pour une marque de café",
    titleEn: "Visual identity for a coffee brand",
    descriptionFr: "Exemple de contenu à personnaliser avec le vrai brief, les choix graphiques et les supports réalisés pour cette marque de café.",
    descriptionEn: "Sample copy to customize with the real brief, design choices and materials created for this coffee brand.",
    category: "Identité visuelle",
  },
  {
    slug: "packaging-cafe-artisanal",
    titleFr: "Packaging pour un café artisanal",
    titleEn: "Packaging for an artisanal coffee",
    descriptionFr: "Exemple de contenu à personnaliser avec les formats de sachets, les finitions d’impression et les éléments de packaging réellement produits.",
    descriptionEn: "Sample copy to customize with the pouch formats, print finishes and packaging elements actually produced.",
    category: "Packaging",
  },
  {
    slug: "campagne-lancement-cosmetique",
    titleFr: "Campagne de lancement d’une gamme cosmétique",
    titleEn: "Launch campaign for a cosmetics range",
    descriptionFr: "Exemple de contenu à personnaliser avec les visuels de campagne, les formats retenus et les canaux utilisés pour le lancement.",
    descriptionEn: "Sample copy to customize with the campaign visuals, selected formats and channels used for the launch.",
    category: "Communication",
  },
  {
    slug: "cartes-de-visite-cabinet-conseil",
    titleFr: "Cartes de visite pour un cabinet de conseil",
    titleEn: "Business cards for a consulting firm",
    descriptionFr: "Exemple de contenu à personnaliser avec la direction artistique, le papier, les finitions et les informations réelles du cabinet.",
    descriptionEn: "Sample copy to customize with the art direction, paper, finishes and actual firm details.",
    category: "Papeterie",
  },
  {
    slug: "brochure-institutionnelle-entreprise",
    titleFr: "Brochure institutionnelle d’entreprise",
    titleEn: "Corporate profile brochure",
    descriptionFr: "Exemple de contenu à personnaliser avec les rubriques, les contenus validés et les caractéristiques de production de la brochure.",
    descriptionEn: "Sample copy to customize with the sections, approved content and production specifications of the brochure.",
    category: "Édition",
  },
  {
    slug: "affiche-evenement-culturel",
    titleFr: "Affiche pour un événement culturel",
    titleEn: "Poster for a cultural event",
    descriptionFr: "Exemple de contenu à personnaliser avec le nom de l’événement, les informations pratiques et les déclinaisons imprimées.",
    descriptionEn: "Sample copy to customize with the event name, practical information and printed adaptations.",
    category: "Affiche",
  },
  {
    slug: "visuels-reseaux-sociaux-restaurant",
    titleFr: "Visuels réseaux sociaux pour un restaurant",
    titleEn: "Social media visuals for a restaurant",
    descriptionFr: "Exemple de contenu à personnaliser avec les formats, les publications créées et l’identité réelle du restaurant.",
    descriptionEn: "Sample copy to customize with the formats, posts created and the restaurant’s real identity.",
    category: "Réseaux sociaux",
  },
  {
    slug: "enseigne-facade-commerce",
    titleFr: "Enseigne et façade pour un commerce",
    titleEn: "Storefront signage for a retail business",
    descriptionFr: "Exemple de contenu à personnaliser avec les dimensions, matériaux, contraintes de pose et visuels réellement installés.",
    descriptionEn: "Sample copy to customize with the dimensions, materials, installation constraints and visuals actually installed.",
    category: "Signalétique",
  },
  {
    slug: "uniformes-personnalises-equipe",
    titleFr: "Uniformes personnalisés pour une équipe",
    titleEn: "Custom uniforms for a team",
    descriptionFr: "Exemple de contenu à personnaliser avec les vêtements, techniques de marquage, quantités et couleurs réalisées.",
    descriptionEn: "Sample copy to customize with the garments, branding techniques, quantities and colors produced.",
    category: "Textile",
  },
  {
    slug: "etiquettes-produit-jus-naturels",
    titleFr: "Étiquettes pour des jus naturels",
    titleEn: "Labels for natural fruit juices",
    descriptionFr: "Exemple de contenu à personnaliser avec les parfums, formats, supports et contraintes d’étiquetage du produit.",
    descriptionEn: "Sample copy to customize with the flavors, sizes, materials and product labeling requirements.",
    category: "Packaging",
  },
  {
    slug: "catalogue-produits-decoration",
    titleFr: "Catalogue de produits de décoration",
    titleEn: "Home décor product catalogue",
    descriptionFr: "Exemple de contenu à personnaliser avec la sélection de produits, les textes, les photographies et les spécifications d’impression.",
    descriptionEn: "Sample copy to customize with the product selection, copy, photography and print specifications.",
    category: "Édition",
  },
  {
    slug: "identite-visuelle-association",
    titleFr: "Identité visuelle d’une association",
    titleEn: "Visual identity for a nonprofit",
    descriptionFr: "Exemple de contenu à personnaliser avec la mission de l’association, le système graphique et ses applications réelles.",
    descriptionEn: "Sample copy to customize with the nonprofit’s mission, visual system and real-world applications.",
    category: "Identité visuelle",
  },
  {
    slug: "kit-communication-conference",
    titleFr: "Kit de communication pour une conférence",
    titleEn: "Communication kit for a conference",
    descriptionFr: "Exemple de contenu à personnaliser avec le programme, les supports de communication et les formats de l’événement.",
    descriptionEn: "Sample copy to customize with the agenda, communication materials and event formats.",
    category: "Communication",
  },
  {
    slug: "menu-imprime-cafe-restaurant",
    titleFr: "Menu imprimé pour un café-restaurant",
    titleEn: "Printed menu for a café",
    descriptionFr: "Exemple de contenu à personnaliser avec la carte réelle, les choix de papier, le format et les finitions.",
    descriptionEn: "Sample copy to customize with the real menu, paper choices, format and finishes.",
    category: "Papeterie",
  },
  {
    slug: "flyers-promotion-boutique",
    titleFr: "Flyers promotionnels pour une boutique",
    titleEn: "Promotional flyers for a shop",
    descriptionFr: "Exemple de contenu à personnaliser avec l’offre, les informations de la boutique et les spécifications d’impression.",
    descriptionEn: "Sample copy to customize with the offer, shop details and print specifications.",
    category: "Flyer",
  },
  {
    slug: "packaging-savon-artisanal",
    titleFr: "Packaging pour des savons artisanaux",
    titleEn: "Packaging for handmade soaps",
    descriptionFr: "Exemple de contenu à personnaliser avec la gamme, les formats d’emballage et les informations produit validées.",
    descriptionEn: "Sample copy to customize with the range, packaging formats and approved product information.",
    category: "Packaging",
  },
  {
    slug: "supports-publicitaires-salon-professionnel",
    titleFr: "Supports publicitaires pour un salon professionnel",
    titleEn: "Promotional materials for a trade show",
    descriptionFr: "Exemple de contenu à personnaliser avec le stand, les supports produits et les éléments visuels de l’événement.",
    descriptionEn: "Sample copy to customize with the booth, produced materials and event visuals.",
    category: "Signalétique",
  },
  {
    slug: "carte-fidelite-commerce-local",
    titleFr: "Carte de fidélité pour un commerce local",
    titleEn: "Loyalty card for a local business",
    descriptionFr: "Exemple de contenu à personnaliser avec le programme de fidélité, les règles et le design réel de la carte.",
    descriptionEn: "Sample copy to customize with the loyalty program, rules and actual card design.",
    category: "Papeterie",
  },
  {
    slug: "packaging-cadeau-entreprise",
    titleFr: "Packaging cadeau pour une entreprise",
    titleEn: "Gift packaging for a business",
    descriptionFr: "Exemple de contenu à personnaliser avec les objets, les matériaux, les finitions et les quantités livrées.",
    descriptionEn: "Sample copy to customize with the items, materials, finishes and quantities delivered.",
    category: "Packaging",
  },
  {
    slug: "campagne-affichage-lancement-produit",
    titleFr: "Campagne d’affichage pour un lancement produit",
    titleEn: "Outdoor campaign for a product launch",
    descriptionFr: "Exemple de contenu à personnaliser avec le produit, les formats d’affichage, les emplacements et les visuels validés.",
    descriptionEn: "Sample copy to customize with the product, display formats, locations and approved visuals.",
    category: "Affiche",
  },
];

async function main() {
  const existingProjects = await prisma.portfolioProject.findMany({
    select: { slug: true, sortOrder: true },
  });
  const existingSlugs = new Set(existingProjects.map((project) => project.slug));
  const nextSortOrder = existingProjects.reduce(
    (highest, project) => Math.max(highest, project.sortOrder),
    -1,
  ) + 1;
  let created = 0;

  for (const [index, project] of projects.entries()) {
    if (existingSlugs.has(project.slug)) continue;

    await prisma.portfolioProject.create({
      data: {
        ...project,
        clientName: null,
        coverImage: null,
        projectDate: null,
        isPublished: false,
        featured: false,
        sortOrder: nextSortOrder + index,
      },
    });
    created += 1;
  }

  console.log(`Portfolio drafts ready: ${created} created, ${projects.length - created} already existed.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
