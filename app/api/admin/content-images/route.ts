import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireAdminOrManager } from "@/lib/admin-api";
import {
  getSupabaseStorage,
  SupabaseStorageConfigurationError,
} from "@/lib/supabase-storage";

export async function GET(request: Request) {
  const authError = await requireAdminOrManager();
  if (authError) return authError;

  const url = new URL(request.url).searchParams.get("url");
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

  const allowedFolders = ["categories/", "content/", "produits/", "realisations/"];
  if (
    !allowedFolders.some((folder) => objectPath.startsWith(folder)) ||
    objectPath.split("/").some((segment) =>
      !segment || segment === "." || segment === ".." || segment.includes("\\"),
    )
  ) {
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

const MAX_SIZE = 8 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

function hasValidSignature(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (type === "image/webp") return bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (type === "image/avif") return bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(4, 8)) === "ftyp" &&
    String.fromCharCode(...bytes.slice(8, 12)).startsWith("avif");
  return false;
}

export async function POST(request: Request) {
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
    return NextResponse.json({ error: "Sélectionnez une image avant le téléversement." }, { status: 400 });
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

  const path = `content/${randomUUID()}.${extension}`;
  const { error } = await storage.client.storage.from(storage.bucket).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    console.error("Téléversement image de contenu:", error.message);
    return NextResponse.json({ error: "Échec du téléversement de l’image." }, { status: 502 });
  }

  const { data } = storage.client.storage.from(storage.bucket).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl }, { status: 201 });
}
