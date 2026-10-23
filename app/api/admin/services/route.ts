import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminOrManager } from "@/lib/admin-api";

const serviceSchema = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  titleFr: z.string().trim().min(2).max(160),
  titleEn: z.string().trim().min(2).max(160),
  descriptionFr: z.string().trim().min(5).max(2000),
  descriptionEn: z.string().trim().min(5).max(2000),
  coverImage: z.string().trim().url().max(2000).or(z.literal("")).transform((value) => value || null).optional(),
  unitPrice: z.number().int().min(0).max(100_000_000_000).nullable().optional(),
  billingUnit: z.string().trim().min(1).max(40).nullable().optional(),
  salesCategory: z.enum(["GRAPHIC_DESIGN", "PRINTING", "ADVERTISING", "OTHER"]).default("OTHER"),
  serviceCategory: z.string().trim().min(2).max(80).nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10000).default(0),
});

function refreshServices() {
  revalidateTag("public-services", { expire: 0 });
  revalidatePath("/fr/services");
  revalidatePath("/en/services");
}

export async function GET() {
  const authError = await requireAdminOrManager();
  if (authError) return authError;

  try {
    const services = await prisma.service.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ services });
  } catch (error) {
    console.error("Admin services GET:", error);
    return NextResponse.json({ error: "Impossible de charger les services." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminOrManager();
  if (authError) return authError;

  const body: unknown = await request.json().catch(() => null);
  const parsed = serviceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Vérifie les champs français et anglais du service." },
      { status: 400 },
    );
  }

  try {
    const service = await prisma.service.create({ data: parsed.data });
    refreshServices();
    return NextResponse.json({ service }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Ce slug est déjà utilisé." }, { status: 409 });
    }
    console.error("Admin services POST:", error);
    return NextResponse.json({ error: "Impossible d’enregistrer le service." }, { status: 500 });
  }
}
