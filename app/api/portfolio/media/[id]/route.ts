import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";
import {
  getSupabaseStorage,
  SupabaseStorageConfigurationError,
} from "@/lib/supabase-storage";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const media = await prisma.media.findFirst({
    where: { id, projectId: { not: null } },
    select: {
      type: true,
      url: true,
      project: {
        select: { id: true, isPublished: true },
      },
    },
  });

  if (!media?.project || media.type !== "IMAGE") {
    return NextResponse.json({ error: "Image introuvable." }, { status: 404 });
  }

  if (!media.project.isPublished) {
    const authError = await requireAdmin();
    if (authError) return authError;
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

  const publicUrl = new URL(media.url);
  const storageUrl = new URL(storage.url);
  const objectPrefix =
    `/storage/v1/object/public/${encodeURIComponent(storage.bucket)}` +
    `/realisations/${media.project.id}/`;

  if (
    publicUrl.origin !== storageUrl.origin ||
    !publicUrl.pathname.startsWith(objectPrefix)
  ) {
    return NextResponse.json({ error: "Image introuvable." }, { status: 404 });
  }

  const objectName = decodeURIComponent(
    publicUrl.pathname.slice(objectPrefix.length),
  );

  if (!/^[\w-]+\.(?:jpg|png|webp|avif)$/i.test(objectName)) {
    return NextResponse.json({ error: "Image introuvable." }, { status: 404 });
  }

  const { data, error } = await storage.client.storage
    .from(storage.bucket)
    .createSignedUrl(`realisations/${media.project.id}/${objectName}`, 3600);

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
