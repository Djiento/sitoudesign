export type ManagedImageType =
  | "article"
  | "business-solution"
  | "category"
  | "portfolio"
  | "product"
  | "service";

function isSupabasePublicImage(imageUrl: string) {
  try {
    const url = new URL(imageUrl);
    return url.hostname.endsWith(".supabase.co") &&
      url.pathname.startsWith("/storage/v1/object/public/");
  } catch {
    return false;
  }
}

export function managedImageUrl(
  imageUrl: string | null | undefined,
  type: ManagedImageType,
  slug: string,
): string | null {
  if (!imageUrl) return null;
  if (!isSupabasePublicImage(imageUrl)) return imageUrl;

  const query = new URLSearchParams({ url: imageUrl });
  return `/api/public/images/${type}/${encodeURIComponent(slug)}?${query}`;
}

export function adminManagedImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (!isSupabasePublicImage(imageUrl)) return imageUrl;

  const query = new URLSearchParams({ url: imageUrl });
  return `/api/admin/content-images?${query}`;
}
