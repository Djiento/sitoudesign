import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";

const publicContentCache = {
  stale: 30,
  revalidate: 60,
  expire: 300,
};

export async function getPublicServices() {
  "use cache";
  cacheLife(publicContentCache);
  cacheTag("public-services");

  return prisma.service.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function getPublicService(slug: string) {
  "use cache";
  cacheLife(publicContentCache);
  cacheTag("public-services");

  return prisma.service.findFirst({
    where: { slug, isActive: true },
  });
}

export async function getPublicProducts() {
  "use cache";
  cacheLife(publicContentCache);
  cacheTag("public-products");

  return prisma.product.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      category: {
        select: {
          nameFr: true,
          nameEn: true,
          slug: true,
          coverImage: true,
        },
      },
      media: {
        where: { type: "IMAGE" },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

export async function getPublicProduct(slug: string) {
  "use cache";
  cacheLife(publicContentCache);
  cacheTag("public-products");

  return prisma.product.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      category: true,
      media: {
        where: { type: "IMAGE" },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

export async function getPublicPortfolioProjects(limit?: number) {
  "use cache";
  cacheLife(publicContentCache);
  cacheTag("public-portfolio");

  return prisma.portfolioProject.findMany({
    where: { isPublished: true },
    select: {
      slug: true,
      titleFr: true,
      titleEn: true,
      descriptionFr: true,
      descriptionEn: true,
      category: true,
      coverImage: true,
      gallery: {
        where: { type: "IMAGE" },
        select: { id: true, altFr: true, altEn: true, url: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: [
      { featured: "desc" },
      { sortOrder: "asc" },
      { createdAt: "desc" },
    ],
    ...(limit ? { take: limit } : {}),
  });
}

export async function getPublicPortfolioProject(slug: string) {
  "use cache";
  cacheLife(publicContentCache);
  cacheTag("public-portfolio");

  return prisma.portfolioProject.findFirst({
    where: { slug, isPublished: true },
    include: {
      gallery: {
        where: { type: "IMAGE" },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}
