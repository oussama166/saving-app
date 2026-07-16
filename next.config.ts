import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Next.js (dev server) bloque par défaut les requêtes cross-origin vers
  // les assets/HMR (_next/*) si l'Origin ne correspond pas au Host attendu.
  // Nécessaire pour partager le site via un tunnel (ngrok, etc.) : sans ça,
  // la page HTML initiale charge mais tout le JS/hydratation/fetch échoue
  // silencieusement ("le site charge mais rien ne fonctionne").
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok.io", "*.ngrok.app"],
};

export default nextConfig;
