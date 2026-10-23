import { PrismaClient } from "@prisma/client";
import content from "../lib/starter-content.json" with { type: "json" };

const prisma = new PrismaClient();

async function seedServices() {
  let count = await prisma.service.count({ where: { isActive: true } });
  for (const [index, service] of content.services.entries()) {
    if (count >= 15) break;
    const exists = await prisma.service.findUnique({ where: { slug: service.slug }, select: { id: true } });
    if (exists) continue;
    await prisma.service.create({
      data: { ...service, coverImage: content.images[index], sortOrder: count, isActive: true },
    });
    count += 1;
  }
}

async function seedSolutions() {
  let count = await prisma.businessSolution.count({ where: { isActive: true } });
  for (const [index, solution] of content.solutions.entries()) {
    if (count >= 15) break;
    const exists = await prisma.businessSolution.findUnique({ where: { slug: solution.slug }, select: { id: true } });
    if (exists) continue;
    await prisma.businessSolution.create({
      data: { ...solution, coverImage: content.images[index], sortOrder: count, isActive: true },
    });
    count += 1;
  }
  await prisma.managedContentSection.upsert({
    where: { key: "business-solutions" },
    update: {},
    create: { key: "business-solutions" },
  });
}

async function seedArticles() {
  let count = await prisma.article.count({ where: { isPublished: true } });
  for (const [index, article] of content.articles.entries()) {
    if (count >= 15) break;
    const exists = await prisma.article.findUnique({ where: { slug: article.slug }, select: { id: true } });
    if (exists) continue;
    await prisma.article.create({
      data: {
        ...article,
        coverImage: content.images[index],
        isPublished: true,
        publishedAt: new Date(),
      },
    });
    count += 1;
  }
  await prisma.managedContentSection.upsert({
    where: { key: "advice-articles" },
    update: {},
    create: { key: "advice-articles" },
  });
}

async function seedProducts() {
  let count = await prisma.product.count({ where: { status: "PUBLISHED" } });
  const categories = new Map();
  for (const [index, product] of content.products.entries()) {
    if (count >= 15) break;
    const exists = await prisma.product.findUnique({ where: { slug: product.slug }, select: { id: true } });
    if (exists) continue;

    let category = categories.get(product.categorySlug);
    if (!category) {
      category = await prisma.category.upsert({
        where: { slug: product.categorySlug },
        update: {},
        create: {
          slug: product.categorySlug,
          nameFr: product.categoryFr,
          nameEn: product.categoryEn,
          coverImage: content.images[index],
          sortOrder: categories.size,
        },
      });
      categories.set(product.categorySlug, category);
    }

    await prisma.product.create({
      data: {
        slug: product.slug,
        nameFr: product.nameFr,
        nameEn: product.nameEn,
        descriptionFr: product.descriptionFr,
        descriptionEn: product.descriptionEn,
        shortDescFr: product.descriptionFr,
        shortDescEn: product.descriptionEn,
        categoryId: category.id,
        status: "PUBLISHED",
        featured: index < 5,
        sortOrder: count,
        media: {
          create: {
            url: content.images[index],
            altFr: product.nameFr,
            altEn: product.nameEn,
          },
        },
      },
    });
    count += 1;
  }
}

try {
  await seedServices();
  await seedSolutions();
  await seedArticles();
  await seedProducts();

  const [services, solutions, articles, products] = await Promise.all([
    prisma.service.count(),
    prisma.businessSolution.count(),
    prisma.article.count(),
    prisma.product.count({ where: { status: "PUBLISHED" } }),
  ]);
  console.log(`Public content ready: ${services} services, ${solutions} business solutions, ${articles} articles, ${products} published products.`);
} finally {
  await prisma.$disconnect();
}
