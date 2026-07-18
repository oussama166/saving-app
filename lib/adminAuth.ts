import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// Auth admin totalement séparée de lib/auth.ts (secret différent, cookie
// différent, TTL bien plus court) — un compte admin compromis ne doit pas
// donner accès aux sessions utilisateurs et inversement. Reste Edge-safe
// (jose + next/headers uniquement, jamais de Prisma ici) pour pouvoir être
// vérifié dans middleware.ts.

export const ADMIN_SESSION_COOKIE = "wealth_os_admin_session";
const ADMIN_SESSION_TTL_SECONDS = 4 * 60 * 60; // 4h — session courte, compte à privilèges élevés

function getAdminSecretKey() {
  const secret = process.env.ADMIN_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "ADMIN_AUTH_SECRET manquant dans .env — génère une valeur aléatoire distincte de AUTH_SECRET (ex: `openssl rand -base64 32`) et ajoute ADMIN_AUTH_SECRET=<valeur> à .env.",
    );
  }
  return new TextEncoder().encode(secret);
}

export interface AdminSessionPayload {
  adminId: string;
  email: string;
}

export async function createAdminSessionToken(payload: AdminSessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_TTL_SECONDS}s`)
    .sign(getAdminSecretKey());
}

export async function verifyAdminSessionToken(token: string): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAdminSecretKey());
    if (typeof payload.adminId !== "string" || typeof payload.email !== "string") return null;
    return { adminId: payload.adminId, email: payload.email };
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyAdminSessionToken(token);
}

export async function requireAdminSession(): Promise<AdminSessionPayload> {
  const session = await getAdminSession();
  if (!session) throw new Error("ADMIN_UNAUTHENTICATED");
  return session;
}

export const ADMIN_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  // path: "/" (et non "/admin") — les pages admin (/admin/*) appellent des
  // routes API sous /api/admin/*, un préfixe différent. Un cookie scopé à
  // "/admin" ne matcherait pas "/api/admin/..." (préfixes disjoints) et ne
  // serait donc jamais envoyé aux routes API. Le cookie reste httpOnly et
  // n'est de toute façon utile qu'aux routes qui l'attendent explicitement.
  path: "/",
  maxAge: ADMIN_SESSION_TTL_SECONDS,
};
