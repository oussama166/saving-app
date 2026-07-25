import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/auth";
import { ADMIN_SESSION_COOKIE } from "@/lib/adminAuth";

// Pages accessibles sans être connecté, redirigées vers "/" si déjà connecté
// (pas de raison de revoir un formulaire de connexion/inscription).
const PUBLIC_PATHS = ["/login", "/signup"];
// Pages accessibles sans être connecté, mais PAS redirigées si déjà connecté
// (un lien de réinitialisation de mot de passe reçu par email doit rester
// utilisable même si une session est active sur l'appareil).
const ALWAYS_PUBLIC_PATHS = ["/forgot-password", "/reset-password"];
// Préfixes d'API accessibles sans session cookie : l'inscription/connexion
// elles-mêmes, l'archivage planifié (protégé par son propre header
// `x-backup-secret` — voir app/api/backup/archive/route.ts), et les webhooks
// externes (protégés par leur propre token `Authorization: Bearer <token>`
// via requireWebhookAuth() — voir lib/webhookAuth.ts). Ces routes gèrent
// elles-mêmes leur authentification ; le middleware ne doit pas exiger un
// cookie de session en plus, sinon un appel externe (iOS Shortcut, service
// tiers) sans navigateur se fait toujours rejeter en 401 avant même
// d'atteindre le handler de la route.
// "/api/cron/" suit le même principe que "/api/backup/" (protégé par son
// propre header `x-cron-secret`, appelé par un job planifié externe —
// cron-job.org, GitHub Actions... — voir app/api/cron/weekly-digest/route.ts).
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/backup/", "/api/webhook/", "/api/cron/"];

// Espace admin (voir lib/adminAuth.ts) : session totalement séparée de l'auth
// utilisateur ci-dessus (cookie et secret dédiés). /admin/login et
// /api/admin/login restent accessibles sans session admin, tout le reste
// sous /admin ou /api/admin exige un cookie admin valide.
const ADMIN_PUBLIC_PATHS = ["/admin/login"];
const ADMIN_PUBLIC_API_PREFIXES = ["/api/admin/login"];

async function isValidSession(token: string | undefined) {
  if (!token) return false;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

async function isValidAdminSession(token: string | undefined) {
  if (!token) return false;
  const secret = process.env.ADMIN_AUTH_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p)) ||
    ALWAYS_PUBLIC_PATHS.includes(pathname)
  ) {
    return NextResponse.next();
  }

  // Espace admin : circuit d'auth entièrement séparé, jamais mélangé avec la
  // logique utilisateur ci-dessous (voir lib/adminAuth.ts).
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (
      ADMIN_PUBLIC_PATHS.includes(pathname) ||
      ADMIN_PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))
    ) {
      return NextResponse.next();
    }

    const adminToken = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const adminAuthenticated = await isValidAdminSession(adminToken);

    if (!adminAuthenticated) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { success: false, error: "Non authentifié (admin)" },
          { status: 401 },
        );
      }
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }

    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const authenticated = await isValidSession(token);
  const isPublicPage = PUBLIC_PATHS.includes(pathname);

  if (isPublicPage) {
    // Un utilisateur déjà connecté n'a pas besoin de revoir /login ou /signup.
    if (authenticated) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!authenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Non authentifié" },
        { status: 401 },
      );
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
