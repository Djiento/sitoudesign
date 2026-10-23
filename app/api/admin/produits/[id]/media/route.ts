
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminOrManager } from "@/lib/admin-api";
import {
  getSupabaseStorage,
  SupabaseStorageConfigurationError,
} from "@/lib/supabase-storage";

const MAX_SIZE = 8 * 1024 * 1024;

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

function hasValidSignature(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") {
    return bytes.length >= 3 &&
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
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

export async function POST(request: Request, { params }: RouteContext) {
  const authError = await requireAdminOrManager();
  if (authError) return authError;

  let storage: ReturnType<typeof getSupabaseStorage>;

  try {
    storage = getSupabaseStorage();
  } catch (error) {
    if (!(error instanceof SupabaseStorageConfigurationError)) {
      throw error;
    }

    console.error("Configuration Supabase Storage:", error.message);
    return NextResponse.json(
      {
        error: `${error.message} Ajoutez la clé secrète au fichier .env puis redémarrez Next.js.`,
      },
      { status: 503 },
    );
  }

  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!product) {
    return NextResponse.json(
      { error: "Produit introuvable." },
      { status: 404 },
    );
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Formulaire de fichier invalide." },
      { status: 400 },
    );
  }

  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "Sélectionne une image." },
      { status: 400 },
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "L'image ne doit pas dépasser 8 Mo." },
      { status: 413 },
    );
  }

  const extension = allowedTypes.get(file.type);

  if (!extension) {
    return NextResponse.json(
      { error: "Formats acceptés : JPEG, PNG, WebP et AVIF." },
      { status: 415 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  if (!hasValidSignature(file.type, bytes)) {
    return NextResponse.json(
      { error: "Le contenu du fichier ne correspond pas à une image valide." },
      { status: 415 },
    );
  }

  const path = `produits/${id}/${randomUUID()}.${extension}`;

  const { error: uploadError } = await storage.client.storage
    .from(storage.bucket)
    .upload(path, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("Upload Supabase :", uploadError.message);

    return NextResponse.json(
      { error: "Échec du téléversement de l'image." },
      { status: 502 },
    );
  }

  const { data: publicData } = storage.client.storage
    .from(storage.bucket)
    .getPublicUrl(path);

  try {
    const media = await prisma.media.create({
      data: {
        type: "IMAGE",
        url: publicData.publicUrl,
        fileName: file.name.slice(0, 255),
        mimeType: file.type,
        sizeBytes: file.size,
        productId: id,
      },
    });

    revalidateTag("public-products", { expire: 0 });
    return NextResponse.json({ media }, { status: 201 });
  } catch (error) {
    const { error: cleanupError } = await storage.client.storage
      .from(storage.bucket)
      .remove([path]);

    if (cleanupError) {
      console.error("Nettoyage image produit:", cleanupError.message);
    }

    console.error("Enregistrement du média :", error);

    return NextResponse.json(
      { error: "Image téléversée, mais impossible d'enregistrer ses informations." },
      { status: 500 },
    );
  }
}