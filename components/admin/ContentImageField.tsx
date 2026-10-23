"use client";

import { useId, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { adminManagedImageUrl } from "@/lib/managed-image-url";

export default function ContentImageField({
  value,
  onChange,
  label,
  uploadLabel,
  removeLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  uploadLabel: string;
  removeLabel: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/admin/content-images", { method: "POST", body: formData });
      const result: { url?: string; error?: string } = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || "Impossible d’envoyer cette image.");
      onChange(result.url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Impossible d’envoyer cette image.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="admin-content-image-field admin-form-full">
      <label htmlFor={inputId}>{label}</label>
      <div className="admin-content-image-controls">
        <input id={inputId} type="url" value={value} onChange={(event) => onChange(event.target.value)} placeholder="https://…" />
        <input
          ref={inputRef}
          className="admin-content-image-file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={(event) => void upload(event.target.files?.[0])}
          aria-label={uploadLabel}
        />
        <button type="button" className="admin-quiet-button" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <LoaderCircle size={16} className="animate-spin" /> : <ImagePlus size={16} />}
          {uploading ? "Envoi…" : uploadLabel}
        </button>
        {value && <button type="button" className="admin-icon-button" onClick={() => onChange("")} aria-label={removeLabel}><X size={16} /></button>}
      </div>
      {error && <p className="admin-form-error" role="alert">{error}</p>}
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="admin-content-image-preview" src={adminManagedImageUrl(value) ?? undefined} alt={label} />
      )}
      <small>JPEG, PNG, WebP ou AVIF · 8 Mo maximum</small>
    </div>
  );
}
