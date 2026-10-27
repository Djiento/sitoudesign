
const CACHE_NAME = "sitou-design-static-v1";

const STATIC_PATHS = [
  "/logo.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_PATHS))
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("sitou-design-static-") &&
              key !== CACHE_NAME
          )
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // Ne jamais intercepter les API ou les pages de navigation.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data/") ||
    url.pathname.startsWith("/fr/admin") ||
    url.pathname.startsWith("/en/admin") ||
    url.pathname.startsWith("/fr/connexion-admin") ||
    url.pathname.startsWith("/en/connexion-admin") ||
    request.mode === "navigate"
  ) {
    return;
  }

  // Mise en cache limitée aux ressources statiques explicitement autorisées.
  const isNextStatic = url.pathname.startsWith("/_next/static/");
  const isPwaAsset = STATIC_PATHS.includes(url.pathname);

  if (!isNextStatic && !isPwaAsset) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);

      if (cached) return cached;

      try {
        const response = await fetch(request);

        if (response.ok && response.type === "basic") {
          await cache.put(request, response.clone());
        }

        return response;
      } catch {
        return new Response("Ressource indisponible hors connexion.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    })
  );
});
