import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Next.js (dev server) bloque par défaut les requêtes cross-origin vers
  // les assets/HMR (_next/*) si l'Origin ne correspond pas au Host attendu.
  // Nécessaire pour partager le site via un tunnel (ngrok, etc.) : sans ça,
  // la page HTML initiale charge mais tout le JS/hydratation/fetch échoue
  // silencieusement ("le site charge mais rien ne fonctionne").
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok.io", "*.ngrok.app"],

  // pdfkit lit ses fichiers de métriques des 14 polices PDF standard
  // (*.afm) depuis son propre dossier via fs au runtime — le traçage
  // automatique des fichiers de Next/Vercel ne les détecte pas toujours
  // (problème connu, pdfkit ne les référence pas via un `import` statique).
  // Sans ça, /api/reports/bilan-pdf fonctionne en local mais plante en prod
  // sur Vercel ("ENOENT" sur un .afm) une fois déployé en serverless.
  outputFileTracingIncludes: {
    "/api/reports/bilan-pdf": ["./node_modules/pdfkit/js/data/**"],
  },
};

export default nextConfig;
