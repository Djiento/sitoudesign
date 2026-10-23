"use client";

import { usePathname } from "next/navigation";

export default function Loading() {
  const isEnglish = usePathname().startsWith("/en/");

  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="route-loading-spinner" aria-hidden="true" />
      <span>{isEnglish ? "Loading page…" : "Chargement de la page…"}</span>
    </div>
  );
}
