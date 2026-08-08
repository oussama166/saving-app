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

// Notifications push (voir lib/webPush.ts côté serveur, PushNotificationCard
// côté client) — payload JSON envoyé par web-push, format { title, body, url }.
// notificationclick : focus un onglet déjà ouvert sur l'app si possible,
// sinon en ouvre un nouveau sur l'url fournie (ou "/" par défaut).
self.addEventListener("push", (event) => {
  // console.log volontairement laissé (pas de vrais secrets dedans) : seul
  // moyen de confirmer, via DevTools > Application > Service Workers, que le
  // message a bien atteint le navigateur — utile pour distinguer "le push
  // n'arrive jamais" (problème d'abonnement/VAPID) de "il arrive mais rien
  // ne s'affiche" (permissions OS/Focus, voir showNotification ci-dessous).
  console.log("[sw] push event reçu", event.data ? "avec payload" : "sans payload");
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "WealthOS", body: event.data.text() };
  }
  const { title = "WealthOS", body = "", url = "/" } = payload;
  event.waitUntil(
    self.registration
      .showNotification(title, {
        body,
        icon: "/logo-192.png",
        badge: "/logo-192.png",
        data: { url },
      })
      .then(() => console.log("[sw] showNotification résolu sans erreur"))
      .catch((err) => console.error("[sw] showNotification a échoué", err)),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});

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
