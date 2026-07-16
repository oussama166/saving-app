import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/auth";

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
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/backup/", "/api/webhook/"];

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
