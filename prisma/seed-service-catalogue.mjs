import { PrismaClient } from "@prisma/client";
import catalogue from "../lib/service-catalogue.json" with { type: "json" };
import starterContent from "../lib/starter-content.json" with { type: "json" };

const prisma = new PrismaClient();

function createDescriptions(service, category) {
  return {
    descriptionFr: `${service[1]} : ${category.descriptionFr} Nous adaptons le format, le contenu et les finitions à votre besoin, avec validation des éléments avant la réalisation.`,
    descriptionEn: `${service[2]}: ${category.descriptionEn} We adapt the format, content and finish to your needs, and confirm the details before production.`,
  };
}

async function main() {
  await prisma.service.updateMany({
    where: { slug: { in: starterContent.services.map((service) => service.slug) } },
    data: { isActive: false },
  });

  let created = 0;
  for (const [categoryIndex, category] of catalogue.categories.entries()) {
    const services = catalogue.services.filter((service) => service[3] === category.key);
    for (const [serviceIndex, service] of services.entries()) {
      const [slug, titleFr, titleEn] = service;
      const descriptions = createDescriptions(service, category);
      const existing = await prisma.service.findUnique({ where: { slug }, select: { id: true } });
      await prisma.service.upsert({
        where: { slug },
        update: {
          serviceCategory: category.key,
          isActive: true,
          sortOrder: categoryIndex * 100 + serviceIndex,
        },
        create: {
          slug,
          titleFr,
          titleEn,
          ...descriptions,
          serviceCategory: category.key,
          salesCategory: category.key === "design-graphique" ? "GRAPHIC_DESIGN" : category.key === "impression-numerique" ? "PRINTING" : category.key === "signaletique-enseignes" || category.key === "impression-grand-format" ? "ADVERTISING" : "OTHER",
          coverImage: null,
          isActive: true,
          sortOrder: categoryIndex * 100 + serviceIndex,
        },
      });
      if (!existing) created += 1;
    }
  }

  const activeCount = await prisma.service.count({ where: { isActive: true } });
  console.log(`Service catalogue ready: ${catalogue.categories.length} categories, ${catalogue.services.length} services (${created} created, ${activeCount} active).`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
