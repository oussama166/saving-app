import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireSession, type SessionPayload } from "@/lib/auth";

// IMPORTANT : ce fichier est séparé de lib/auth.ts exprès. lib/auth.ts est
// importé par middleware.ts, qui tourne dans l'Edge Runtime — celui-ci ne
// supporte ni le module Node 'crypto' ni le client Prisma (bindings
// natifs). En gardant ces imports ici, on évite de casser le middleware.

/**
 * Génère un nouveau token de webhook (ex: `wos_<64 hex chars>`), pour un
 * usage externe (iOS Shortcut, service tiers) distinct du cookie de session
 * navigateur. À passer en header `Authorization: Bearer <token>`.
 */
export function generateWebhookToken(): string {
  return `wos_${randomBytes(32).toString("hex")}`;
}

/**
 * Authentifie une requête de webhook externe via le header
 * `Authorization: Bearer <token>`, en comparant au `User.webhookToken`
 * stocké en base. À utiliser à la place de `requireSession()` pour les
 * routes appelées par un iOS Shortcut ou un service tiers plutôt que par
 * le navigateur de l'utilisateur.
 */
export async function requireWebhookToken(req: Request): Promise<SessionPayload> {
  const authHeader = req.headers.get("authorization") ?? "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new Error("UNAUTHENTICATED");
  }

  const user = await prisma.user.findUnique({ where: { webhookToken: token } });
  if (!user) throw new Error("UNAUTHENTICATED");

  return { userId: user.id, email: user.email };
}

/**
 * Variante "webhook" tolérante : accepte soit un token de webhook (header
 * Authorization), soit une session navigateur classique (cookie) — utile
 * pour que la route reste testable/appelable depuis l'app elle-même tout en
 * supportant les appels externes (Shortcut iOS, etc.).
 */
export async function requireWebhookAuth(req: Request): Promise<SessionPayload> {
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    return requireWebhookToken(req);
  }
  return requireSession();
}
