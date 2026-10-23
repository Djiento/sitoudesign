import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-api";
import { revalidatePortfolioPages } from "@/lib/revalidate-portfolio";
import {
  getSupabaseStorage,
  SupabaseStorageConfigurationError,
} from "@/lib/supabase-storage";



type RouteContext = {
  params: Promise<{ id: string }>;
};

async function listProjectStorageFiles(
  storage: ReturnType<typeof getSupabaseStorage>,
  projectId: string,
): Promise<string[]> {
  const files: string[] = [];
  const folders = [`realisations/${projectId}`];

  while (folders.length > 0) {
    const folder = folders.pop();
    if (!folder) continue;

    let offset = 0;

    while (true) {
      const { data, error } = await storage.client.storage
        .from(storage.bucket)
        .list(folder, { limit: 1000, offset });

      if (error) throw error;

      for (const entry of data) {
        const path = `${folder}/${entry.name}`;
        if (entry.id) {
          files.push(path);
        } else {
          folders.push(path);
        }
      }

      if (data.length < 1000) break;
      offset += data.length;
    }
  }

  return files;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 150);
}

function optionalText(value: unknown): string | null {
  return text(value) || null;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }

  const current = await prisma.portfolioProject.findUnique({
    where: { id },
    select: { id: true, slug: true },
  });

  if (!current) {
    return NextResponse.json(
      { error: "Réalisation introuvable." },
      { status: 404 },
    );
  }

  const data: Prisma.PortfolioProjectUpdateInput = {};

  for (const field of [
    "titleFr",
    "titleEn",
    "descriptionFr",
    "descriptionEn",
  ] as const) {
    if (field in body) {
      if (typeof body[field] !== "string" || !text(body[field])) {
        return NextResponse.json(
          { error: `Le champ ${field} ne peut pas être vide.` },
          { status: 400 },
        );
      }
      data[field] = text(body[field]);
    }
  }

  if ("slug" in body) {
    const slug = slugify(text(body.slug));

    if (!slug) {
      return NextResponse.json(
        { error: "Le slug est invalide." },
        { status: 400 },
      );
    }

    const duplicate = await prisma.portfolioProject.findFirst({
      where: { slug, NOT: { id } },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: "Ce slug est déjà utilisé." },
        { status: 409 },
      );
    }

    data.slug = slug;
  }

  for (const field of [
    "clientName",
    "category",
    "coverImage",
  ] as const) {
    if (field in body) {
      if (
        body[field] !== null &&
        typeof body[field] !== "string"
      ) {
        return NextResponse.json(
          { error: `Le champ ${field} est invalide.` },
          { status: 400 },
        );
      }
      data[field] = optionalText(body[field]);
    }
  }

  if ("projectDate" in body) {
    if (body.projectDate === null || body.projectDate === "") {
      data.projectDate = null;
    } else if (typeof body.projectDate === "string") {
      const date = new Date(body.projectDate);

      if (Number.isNaN(date.getTime())) {
        return NextResponse.json(
          { error: "La date du projet est invalide." },
          { status: 400 },
        );
      }

      data.projectDate = date;
    } else {
      return NextResponse.json(
        { error: "La date du projet est invalide." },
        { status: 400 },
      );
    }
  }

  if ("sortOrder" in body) {
    if (
      typeof body.sortOrder !== "number" ||
      !Number.isInteger(body.sortOrder)
    ) {
      return NextResponse.json(
        { error: "L'ordre d'affichage doit être un entier." },
        { status: 400 },
      );
    }
    data.sortOrder = body.sortOrder;
  }

  for (const field of ["featured", "isPublished"] as const) {
    if (field in body) {
      if (typeof body[field] !== "boolean") {
        return NextResponse.json(
          { error: `Le champ ${field} doit être un booléen.` },
          { status: 400 },
        );
      }
      data[field] = body[field];
    }
  }

  try {
    const project = await prisma.portfolioProject.update({
      where: { id },
      data,
      include: {
        gallery: { orderBy: { sortOrder: "asc" } },
      },
    });

    revalidatePortfolioPages();
    return NextResponse.json({ project });
  } catch (error) {
    console.error("Admin portfolio PATCH:", error);
    return NextResponse.json(
      { error: "Impossible de modifier la réalisation." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;

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

  try {
    const project = await prisma.portfolioProject.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Réalisation introuvable." },
        { status: 404 },
      );
    }

    const files = await listProjectStorageFiles(storage, id);

    for (let start = 0; start < files.length; start += 1000) {
      const { error: storageError } = await storage.client.storage
        .from(storage.bucket)
        .remove(files.slice(start, start + 1000));

      if (storageError) {
        console.error("Suppression images réalisation:", storageError.message);
        return NextResponse.json(
          { error: "Impossible de supprimer les images de la réalisation." },
          { status: 502 },
        );
      }
    }

    await prisma.portfolioProject.delete({ where: { id } });

    revalidatePortfolioPages();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin portfolio DELETE:", error);
    return NextResponse.json(
      { error: "Impossible de supprimer la réalisation." },
      { status: 500 },
    );
  }
}