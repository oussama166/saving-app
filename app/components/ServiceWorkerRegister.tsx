"use client";

import { useEffect } from "react";

// Enregistre le service worker (voir public/sw.js) — condition requise avec
// le manifest pour que Chrome/Android propose l'installation PWA ("Ajouter
// à l'écran d'accueil"). Ne fait rien côté serveur ni sur un navigateur sans
// support (Safari desktop plus ancien, etc.) — l'app fonctionne
// normalement dans les deux cas, ce n'est qu'une amélioration progressive.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  }, []);

  return null;
}
