import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminOrManager } from "@/lib/admin-api";

type RouteContext = { params: Promise<{ id: string }> };

const serviceUpdateSchema = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  titleFr: z.string().trim().min(2).max(160).optional(),
  titleEn: z.string().trim().min(2).max(160).optional(),
  descriptionFr: z.string().trim().min(5).max(2000).optional(),
  descriptionEn: z.string().trim().min(5).max(2000).optional(),
  coverImage: z.string().trim().url().max(2000).or(z.literal("")).transform((value) => value || null).optional(),
  unitPrice: z.number().int().min(0).max(100_000_000_000).nullable().optional(),
  billingUnit: z.string().trim().min(1).max(40).nullable().optional(),
  salesCategory: z.enum(["GRAPHIC_DESIGN", "PRINTING", "ADVERTISING", "OTHER"]).optional(),
  serviceCategory: z.string().trim().min(2).max(80).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

function refreshServices() {
  revalidateTag("public-services", { expire: 0 });
  revalidatePath("/fr/services");
  revalidatePath("/en/services");
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authError = await requireAdminOrManager();
  if (authError) return authError;

  const body: unknown = await request.json().catch(() => null);
  const parsed = serviceUpdateSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    return NextResponse.json({ error: "Aucune modification valide à enregistrer." }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const service = await prisma.service.update({
      where: { id },
      data: parsed.data,
    });
    refreshServices();
    return NextResponse.json({ service });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Service introuvable." }, { status: 404 });
      }
      if (error.code === "P2002") {
        return NextResponse.json({ error: "Ce slug est déjà utilisé." }, { status: 409 });
      }
    }
    console.error("Admin services PATCH:", error);
    return NextResponse.json({ error: "Impossible de modifier le service." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const authError = await requireAdminOrManager();
  if (authError) return authError;

  try {
    const { id } = await context.params;
    await prisma.service.delete({ where: { id } });
    refreshServices();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Service introuvable." }, { status: 404 });
    }
    console.error("Admin services DELETE:", error);
    return NextResponse.json({ error: "Impossible de supprimer le service." }, { status: 500 });
  }
}
