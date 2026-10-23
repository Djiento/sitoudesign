import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireAdminOrManager } from "@/lib/admin-api";
import {
  getSupabaseStorage,
  SupabaseStorageConfigurationError,
} from "@/lib/supabase-storage";
import { getCategoryStoragePath, removeCategoryStorageImage } from "@/lib/category-storage";

const MAX_SIZE = 8 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

function hasValidSignature(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (type === "image/png") {
    return bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 &&
      bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a &&
      bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  if (type === "image/webp") {
    return bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  if (type === "image/avif") {
    return bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(4, 8)) === "ftyp" &&
      String.fromCharCode(...bytes.slice(8, 12)).startsWith("avif");
  }
  return false;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authError = await requireAdminOrManager();
  if (authError) return authError;

  let storage: ReturnType<typeof getSupabaseStorage>;
  try {
    storage = getSupabaseStorage();
  } catch (error) {
    if (!(error instanceof SupabaseStorageConfigurationError)) throw error;
    console.error("Configuration Supabase Storage:", error.message);
    return NextResponse.json(
      { error: `${error.message} Ajoutez les clés au fichier .env puis redémarrez Next.js.` },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulaire de fichier invalide." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Sélectionne une image avant le téléversement." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "L’image ne doit pas dépasser 8 Mo." }, { status: 413 });
  }

  const extension = allowedTypes.get(file.type);
  if (!extension) {
    return NextResponse.json({ error: "Formats acceptés : JPEG, PNG, WebP et AVIF." }, { status: 415 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasValidSignature(file.type, bytes)) {
    return NextResponse.json({ error: "Le contenu du fichier ne correspond pas à une image valide." }, { status: 415 });
  }

  const { id } = await context.params;
  const category = await prisma.category.findUnique({
    where: { id },
    select: { id: true, coverImage: true },
  });
  if (!category) {
    return NextResponse.json({ error: "Catégorie introuvable." }, { status: 404 });
  }

  const path = `categories/${id}/${randomUUID()}.${extension}`;
  const { error: uploadError } = await storage.client.storage
    .from(storage.bucket)
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("Téléversement image catégorie:", uploadError.message);
    return NextResponse.json({ error: "Échec du téléversement de l’image." }, { status: 502 });
  }

  const { data: publicData } = storage.client.storage.from(storage.bucket).getPublicUrl(path);

  try {
    const updatedCategory = await prisma.category.update({
      where: { id },
      data: { coverImage: publicData.publicUrl },
      include: { _count: { select: { products: true } } },
    });

    const oldPath = getCategoryStoragePath(category.coverImage);
    let cleanupWarning: string | undefined;
    if (oldPath && oldPath !== path) {
      const { error: cleanupError } = await storage.client.storage.from(storage.bucket).remove([oldPath]);
      if (cleanupError) {
        console.error("Suppression ancienne image catégorie:", cleanupError.message);
        cleanupWarning = "La nouvelle image est enregistrée, mais l’ancienne n’a pas pu être supprimée du stockage.";
      }
    }

    return NextResponse.json({ category: updatedCategory, cleanupWarning });
  } catch (error) {
    const { error: cleanupError } = await storage.client.storage.from(storage.bucket).remove([path]);
    if (cleanupError) console.error("Nettoyage image catégorie:", cleanupError.message);
    console.error("Enregistrement image catégorie:", error);
    return NextResponse.json({ error: "Image téléversée, mais impossible de l’associer à la catégorie." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const authError = await requireAdminOrManager();
  if (authError) return authError;

  const { id } = await context.params;
  const category = await prisma.category.findUnique({
    where: { id },
    select: { id: true, coverImage: true },
  });
  if (!category) {
    return NextResponse.json({ error: "Catégorie introuvable." }, { status: 404 });
  }

  try {
    const updatedCategory = await prisma.category.update({
      where: { id },
      data: { coverImage: null },
      include: { _count: { select: { products: true } } },
    });

    const warning = await removeCategoryStorageImage(category.coverImage);

    return NextResponse.json({ category: updatedCategory, warning });
  } catch (error) {
    console.error("Suppression image catégorie:", error);
    return NextResponse.json({ error: "Impossible de retirer l’image de la catégorie." }, { status: 500 });
  }
}
