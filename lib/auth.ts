import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

export const SESSION_COOKIE = "wealth_os_session";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 jours

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET manquant dans .env — génère une valeur aléatoire (ex: `openssl rand -base64 32`) et ajoute AUTH_SECRET=<valeur> à .env avant de démarrer l'app.",
    );
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  userId: string;
  email: string;
  // Identifiant unique de CE jeton précis (une valeur par login/vérif 2FA,
  // pas par utilisateur) — sert de clé de corrélation avec la table Session
  // (voir lib/sessionTracking.ts) pour la liste "appareils connectés" et la
  // révocation à distance. Optionnel côté type seulement pour rester
  // compatible avec d'anciens jetons déjà émis avant l'ajout de ce champ
  // (ils restent valides jusqu'à expiration naturelle, simplement invisibles
  // dans la liste des sessions).
  jti?: string;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

/**
 * Émet un nouveau jeton de session. Génère aussi un `jti` (identifiant
 * unique de CE jeton, via `crypto.randomUUID()` — API Web Crypto globale,
 * disponible aussi bien en runtime Node qu'Edge, donc rien à ajouter à
 * l'import list) et l'inclut dans le JWT. Le retour expose `jti`
 * séparément pour que l'appelant (routes login / 2FA verify, jamais
 * middleware.ts) puisse créer la ligne Session correspondante — voir
 * lib/sessionTracking.ts, gardé dans un fichier séparé pour ne pas faire
 * entrer Prisma dans ce module (importé par middleware.ts, Edge Runtime).
 */
export async function createSessionToken(
  payload: SessionPayload,
): Promise<{ token: string; jti: string }> {
  const jti = crypto.randomUUID();
  const token = await new SignJWT({ ...payload, jti })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
  return { token, jti };
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.userId !== "string" || typeof payload.email !== "string")
      return null;
    return {
      userId: payload.userId,
      email: payload.email,
      jti: typeof payload.jti === "string" ? payload.jti : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * À utiliser dans les Server Components / Route Handlers (lecture du cookie
 * via next/headers). Retourne null si pas connecté ou session invalide.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Variante stricte pour les routes API qui exigent un utilisateur connecté.
 * Le middleware protège déjà les pages/routes, mais chaque route reste
 * responsable de vérifier sa propre session avant de toucher aux données.
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

// Jeton temporaire émis après un mot de passe correct sur un compte avec la
// 2FA activée (voir app/api/auth/login, app/api/auth/2fa/verify) — PAS un
// cookie de session, juste une preuve "étape 1 (mot de passe) réussie" à
// présenter avec le code TOTP/de récupération pour obtenir le vrai cookie de
// session. `purpose: "2fa-pending"` empêche qu'un jeton de ce type soit
// confondu avec/accepté comme un vrai SessionPayload par verifySessionToken
// (types de payload différents), et une TTL courte limite la fenêtre
// d'exploitation s'il fuit (ex: log, historique navigateur).
const TWO_FACTOR_CHALLENGE_TTL_SECONDS = 5 * 60; // 5 minutes

export interface TwoFactorChallengePayload {
  userId: string;
  purpose: "2fa-pending";
}

export async function createTwoFactorChallengeToken(userId: string) {
  return new SignJWT({ userId, purpose: "2fa-pending" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TWO_FACTOR_CHALLENGE_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyTwoFactorChallengeToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.purpose !== "2fa-pending" || typeof payload.userId !== "string") return null;
    return payload.userId;
  } catch {
    return null;
  }
}
