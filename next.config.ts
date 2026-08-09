import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Next.js (dev server) bloque par défaut les requêtes cross-origin vers
  // les assets/HMR (_next/*) si l'Origin ne correspond pas au Host attendu.
  // Nécessaire pour partager le site via un tunnel (ngrok, etc.) : sans ça,
  // la page HTML initiale charge mais tout le JS/hydratation/fetch échoue
  // silencieusement ("le site charge mais rien ne fonctionne").
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok.io",
    "*.ngrok.app",
    "192.168.0.124",
  ],

  // pdfkit lit ses fichiers de métriques des 14 polices PDF standard
  // (*.afm) depuis son propre dossier via `fs.readFileSync(__dirname + ...)`
  // au runtime. Par défaut Next.js bundle les dépendances des routes API
  // avec webpack — une fois pdfkit inlined dans le chunk de la route,
  // `__dirname` ne pointe plus vers node_modules/pdfkit/js/ mais vers le
  // build compilé, donc le .afm n'est jamais trouvé en prod (ENOENT), même
  // si outputFileTracingIncludes copie bien les fichiers. serverExternalPackages
  // force Next à laisser pdfkit en `require()` natif Node (comme @prisma/client
  // l'est déjà par défaut), ce qui préserve un __dirname correct ; combiné à
  // outputFileTracingIncludes ci-dessous pour que ces fichiers non-JS soient
  // bien copiés dans la fonction serverless déployée.
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/reports/bilan-pdf": ["./node_modules/pdfkit/js/data/**"],
  },

  // Headers de sécurité de base, appliqués à toutes les routes. Pas de
  // Content-Security-Policy ici volontairement : le script inline de
  // détection du thème (THEME_INIT_SCRIPT, voir app/layout.tsx) exigerait
  // soit 'unsafe-inline' (protection très réduite contre l'injection de
  // script) soit un système de nonce par requête (plus de travail, à faire
  // séparément si besoin). Ce qui suit reste à risque de casse ~nul et
  // apporte déjà une vraie protection anti-clickjacking/MIME-sniffing.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
