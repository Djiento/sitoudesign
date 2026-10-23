
"use client";

import { useRef, useState } from "react";
import { adminManagedImageUrl } from "@/lib/managed-image-url";

type MediaItem = {
  id: string;
  url: string;
  fileName: string | null;
};

export default function ProductImageUploader({
  productId,
  initialMedia = [],
}: {
  productId: string;
  initialMedia?: MediaItem[];
}) {
  const [media, setMedia] = useState(initialMedia);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload() {
    const file = inputRef.current?.files?.[0];

    setError("");
    setSuccess("");

    if (!file) {
      setError("Choisis une image avant de téléverser.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setBusy(true);

    try {
      const response = await fetch(
        `/api/admin/produits/${encodeURIComponent(productId)}/media`,
        { method: "POST", body: formData },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Échec du téléversement.");
        return;
      }

      setMedia((current) => [...current, data.media]);
      setSuccess("Image enregistrée avec succès.");
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      setError("Erreur réseau pendant le téléversement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Images du produit</h3>
        <p className="text-sm opacity-70">
          JPEG, PNG, WebP ou AVIF — maximum 8 Mo par image.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="file-input file-input-bordered w-full"
          disabled={busy}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={upload}
          disabled={busy}
        >
          {busy ? "Téléversement..." : "Ajouter l’image"}
        </button>
      </div>

      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      {success && <p role="status" className="text-sm text-success">{success}</p>}

      {media.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {media.map((item) => (
            <figure key={item.id} className="overflow-hidden rounded-xl border border-base-300">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={adminManagedImageUrl(item.url) ?? undefined}
                alt={item.fileName ?? "Image du produit"}
                className="aspect-square w-full object-cover"
              />
              <figcaption className="truncate p-2 text-xs">
                {item.fileName ?? "Image du produit"}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-base-300 p-8 text-center text-sm opacity-70">
          Aucune image enregistrée pour ce produit.
        </div>
      )}
    </section>
  );
}
