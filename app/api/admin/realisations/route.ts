import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";
import { revalidatePortfolioPages } from "@/lib/revalidate-portfolio";



function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown): string | null {
  return text(value) || null;
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

function validDate(value: unknown): Date | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const projects = await prisma.portfolioProject.findMany({
      include: {
        gallery: {
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: [
        { sortOrder: "asc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Admin portfolio GET:", error);
    return NextResponse.json(
      { error: "Impossible de charger les réalisations." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }

  const titleFr = text(body.titleFr);
  const titleEn = text(body.titleEn);
  const descriptionFr = text(body.descriptionFr);
  const descriptionEn = text(body.descriptionEn);

  if (!titleFr || !titleEn || !descriptionFr || !descriptionEn) {
    return NextResponse.json(
      {
        error:
          "Les titres et les descriptions en français et en anglais sont obligatoires.",
      },
      { status: 400 },
    );
  }

  const slug = slugify(text(body.slug) || titleFr);

  if (!slug) {
    return NextResponse.json(
      { error: "Le slug est invalide." },
      { status: 400 },
    );
  }

  const projectDate = validDate(body.projectDate);

  if (projectDate === undefined) {
    return NextResponse.json(
      { error: "La date du projet est invalide." },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.portfolioProject.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Ce slug existe déjà. Choisis-en un autre." },
        { status: 409 },
      );
    }

    const project = await prisma.portfolioProject.create({
      data: {
        slug,
        titleFr,
        titleEn,
        descriptionFr,
        descriptionEn,
        clientName: optionalText(body.clientName),
        category: optionalText(body.category),
        coverImage: optionalText(body.coverImage),
        projectDate,
        sortOrder: Number.isInteger(body.sortOrder)
          ? (body.sortOrder as number)
          : 0,
        featured: body.featured === true,
        isPublished: body.isPublished === true,
      },
      include: {
        gallery: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    revalidatePortfolioPages();
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("Admin portfolio POST:", error);
    return NextResponse.json(
      { error: "Impossible de créer la réalisation." },
      { status: 500 },
    );
  }
}