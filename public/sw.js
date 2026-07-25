// Service worker minimal — permet l'installation PWA (critère requis par
// Chrome/Android : un manifest + un service worker actif) et met en cache
// les assets statiques (JS/CSS/polices/icônes) pour un chargement plus
// rapide au retour. Volontairement PAS de cache pour les pages/API : les
// données financières doivent toujours venir du réseau (network-first),
// jamais servies périmées depuis le cache — un cache-first sur du solde de
// compte serait dangereux (montants faux affichés hors-ligne).
const CACHE_NAME = "wealthos-static-v1";
const STATIC_EXTENSIONS = [".js", ".css", ".woff2", ".woff", ".png", ".svg", ".ico"];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

function isStaticAsset(url) {
  return STATIC_EXTENSIONS.some((ext) => url.pathname.endsWith(ext));
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Seules les requêtes GET same-origin vers un asset statique passent par
  // le cache — tout le reste (pages, /api/*, autres origines) va toujours
  // au réseau directement, sans interception.
  if (event.request.method !== "GET" || url.origin !== self.location.origin || !isStaticAsset(url)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      try {
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      } catch {
        return cached || Response.error();
      }
    }),
  );
});
