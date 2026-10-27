
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Sitou Design",
    short_name: "Sitou Design",
    description:
      "Sitou Design — Impression numérique, design graphique et communication visuelle.",
    start_url: "/fr/connexion-admin",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#111827",
    categories: ["business", "productivity"],
    icons: [
  {
    src: "/icons/icon-192.png",
    sizes: "192x192",
    type: "image/png",
    purpose: "any",
  },
  {
    src: "/icons/icon-512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "any",
  },
],
  };
}
