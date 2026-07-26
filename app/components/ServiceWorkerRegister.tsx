"use client";

import { useEffect } from "react";

// Enregistre le service worker (voir public/sw.js) — condition requise avec
// le manifest pour que Chrome/Android propose l'installation PWA ("Ajouter
// à l'écran d'accueil"). Ne fait rien côté serveur ni sur un navigateur sans
// support (Safari desktop plus ancien, etc.) — l'app fonctionne
// normalement dans les deux cas, ce n'est qu'une amélioration progressive.
//
// IMPORTANT : jamais en développement. Le SW fait du cache-first sur les
// assets statiques (.js/.css/...) — en dev, les chunks Turbopack changent à
// chaque modif mais un hard-refresh navigateur NE contourne PAS le cache
// d'un service worker déjà installé (mécanisme distinct du cache HTTP), donc
// un SW enregistré une fois en localhost peut servir indéfiniment de vieux
// bundles JS malgré des redémarrages du serveur — symptôme vécu : du code
// modifié qui "ne s'applique jamais". On désenregistre activement tout SW
// existant + vide son cache en dev, au cas où il aurait déjà été installé
// avant ce correctif.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
      if (typeof caches !== "undefined") {
        caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
      }
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  }, []);

  return null;
}
