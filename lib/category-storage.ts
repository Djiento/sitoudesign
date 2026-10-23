import "server-only";

import { getSupabaseStorage } from "@/lib/supabase-storage";

export function getCategoryStoragePath(imageUrl: string | null) {
  if (!imageUrl) return null;
  const configuredUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configuredUrl) return null;

  try {
    const image = new URL(imageUrl);
    if (image.origin !== new URL(configuredUrl).origin) return null;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "sitou-media";
    const prefix = `/storage/v1/object/public/${bucket}/`;
    if (!image.pathname.startsWith(prefix)) return null;
    const path = decodeURIComponent(image.pathname.slice(prefix.length));
    return path.startsWith("categories/") ? path : null;
  } catch {
    return null;
  }
}

export async function removeCategoryStorageImage(imageUrl: string | null) {
  const path = getCategoryStoragePath(imageUrl);
  if (!path) return null;

  try {
    const storage = getSupabaseStorage();
    const { error } = await storage.client.storage.from(storage.bucket).remove([path]);
    if (error) {
      console.error("Suppression image catégorie:", error.message);
      return "L’image a été retirée de la catégorie, mais n’a pas pu être supprimée du stockage.";
    }
    return null;
  } catch (error) {
    console.error(
      "Suppression image catégorie:",
      error instanceof Error ? error.message : error,
    );
    return "L’image a été retirée de la catégorie, mais n’a pas pu être supprimée du stockage.";
  }
}
