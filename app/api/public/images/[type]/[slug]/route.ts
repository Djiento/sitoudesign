import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSupabaseStorage,
  SupabaseStorageConfigurationError,
} from "@/lib/supabase-storage";

type RouteContext = {
  params: Promise<{ type: string; slug: string }>;
};

async function imageIsPublic(type: string, slug: string, url: string) {
  switch (type) {
    case "article":
      return Boolean(await prisma.article.findFirst({
        where: { slug, coverImage: url, isPublished: true },
        select: { id: true },
      }));
    case "business-solution":
      return Boolean(await prisma.businessSolution.findFirst({
        where: { slug, coverImage: url, isActive: true },
        select: { id: true },
      }));
    case "category":
      return Boolean(await prisma.category.findFirst({
        where: { slug, coverImage: url, isActive: true },
        select: { id: true },
      }));
    case "portfolio":
      return Boolean(await prisma.portfolioProject.findFirst({
        where: {
          slug,
          isPublished: true,
          OR: [
            { coverImage: url },
            { gallery: { some: { url, type: "IMAGE" } } },
          ],
        },
        select: { id: true },
      }));
    case "product":
      return Boolean(await prisma.product.findFirst({
        where: {
          slug,
          status: "PUBLISHED",
          media: { some: { url, type: "IMAGE" } },
        },
        select: { id: true },
      }));
    case "service":
      return Boolean(await prisma.service.findFirst({
        where: { slug, coverImage: url, isActive: true },
        select: { id: true },
      }));
    default:
      return false;
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Image introuvable." }, { status: 404 });
  }

  let imageUrl: URL;
  try {
    imageUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Image introuvable." }, { status: 404 });
  }

  let storage: ReturnType<typeof getSupabaseStorage>;
  try {
    storage = getSupabaseStorage();
  } catch (error) {
    if (!(error instanceof SupabaseStorageConfigurationError)) throw error;
    console.error("Configuration Supabase Storage:", error.message);
    return NextResponse.json(
      { error: "Le stockage des images n'est pas configuré." },
      { status: 503 },
    );
  }

  const prefix = `/storage/v1/object/public/${encodeURIComponent(storage.bucket)}/`;
  if (imageUrl.origin !== new URL(storage.url).origin || !imageUrl.pathname.startsWith(prefix)) {
    return NextResponse.json({ error: "Image introuvable." }, { status: 404 });
  }

  let objectPath: string;
  try {
    objectPath = decodeURIComponent(imageUrl.pathname.slice(prefix.length));
  } catch {
    return NextResponse.json({ error: "Image introuvable." }, { status: 404 });
  }

  if (
    !objectPath ||
    objectPath.split("/").some((segment) =>
      !segment || segment === "." || segment === ".." || segment.includes("\\"),
    )
  ) {
    return NextResponse.json({ error: "Image introuvable." }, { status: 404 });
  }

  const { type, slug } = await context.params;
  if (!await imageIsPublic(type, slug, url)) {
    return NextResponse.json({ error: "Image introuvable." }, { status: 404 });
  }

  const { data, error } = await storage.client.storage
    .from(storage.bucket)
    .createSignedUrl(objectPath, 3600);

  if (error) {
    console.error("Création du lien image Supabase:", error.message);
    return NextResponse.json(
      { error: "Impossible de charger cette image." },
      { status: 502 },
    );
  }

  return NextResponse.redirect(data.signedUrl, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
