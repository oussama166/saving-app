import { prisma } from "@/lib/prisma";

// IMPORTANT : ce fichier est séparé de lib/auth.ts exprès, même pattern que
// lib/webhookAuth.ts. lib/auth.ts est importé par middleware.ts, qui tourne
// dans l'Edge Runtime — celui-ci ne supporte pas le client Prisma. En gardant
// le code Prisma ici, middleware.ts continue de faire uniquement une
// vérification de signature JWT (rapide, Edge-safe), SANS savoir si une
// session a été révoquée entre-temps.
//
// Conséquence assumée : la révocation n'est pas instantanée sur un appel API
// déjà en vol. Elle est appliquée au prochain rendu du layout racine
// (app/layout.tsx, Server Component en runtime Node — voir le check qui y
// est ajouté), donc au plus tard au prochain changement de page. Pour un
// usage personnel (perdre son téléphone après l'avoir connecté), c'est un
// compromis raisonnable face à l'alternative (vérifier la base à CHAQUE
// requête via le middleware, ce qui impliquerait soit de casser l'Edge
// Runtime soit d'ajouter un aller-retour réseau sur absolument toutes les
// pages/API).

function describeUserAgent(userAgent: string | null): string | null {
  if (!userAgent) return null;
  // Résumé grossier mais lisible plutôt que l'UA brut illisible — suffisant
  // pour qu'un utilisateur reconnaisse "iPhone / Safari" vs "Mac / Chrome".
  const ua = userAgent;
  let device = "Ordinateur";
  if (/iphone/i.test(ua)) device = "iPhone";
  else if (/ipad/i.test(ua)) device = "iPad";
  else if (/android/i.test(ua)) device = "Android";
  else if (/macintosh/i.test(ua)) device = "Mac";
  else if (/windows/i.test(ua)) device = "Windows";
  else if (/linux/i.test(ua)) device = "Linux";

  let browser = "Navigateur";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) browser = "Chrome";
  else if (/crios\//i.test(ua)) browser = "Chrome";
  else if (/fxios\//i.test(ua) || /firefox\//i.test(ua)) browser = "Firefox";
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua) && !/crios\//i.test(ua)) browser = "Safari";

  return `${device} · ${browser}`;
}

/**
 * Crée la ligne Session correspondant à un jeton fraîchement émis (login ou
 * vérif 2FA). Best-effort : une erreur ici ne doit jamais empêcher la
 * connexion elle-même (le cookie de session est déjà valide sans ça).
 */
export async function createSessionRecord(params: {
  userId: string;
  jti: string;
  rawUserAgent: string | null;
}): Promise<void> {
  try {
    await prisma.session.create({
      data: {
        userId: params.userId,
        jti: params.jti,
        userAgent: describeUserAgent(params.rawUserAgent),
      },
    });
  } catch (error) {
    console.error("createSessionRecord error:", error);
  }
}

export interface SessionListItem {
  id: string;
  userAgent: string | null;
  createdAt: Date;
  isCurrent: boolean;
}

/**
 * Liste les sessions actives (non révoquées) d'un utilisateur, les plus
 * récentes d'abord. `currentJti` sert uniquement à marquer visuellement
 * "cet appareil" dans l'UI — ne change rien à l'autorisation.
 */
export async function listActiveSessions(
  userId: string,
  currentJti: string | undefined,
): Promise<SessionListItem[]> {
  const sessions = await prisma.session.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return sessions.map((s) => ({
    id: s.id,
    userAgent: s.userAgent,
    createdAt: s.createdAt,
    isCurrent: s.jti === currentJti,
  }));
}

/**
 * Révoque une session (marque revokedAt) — n'agit que sur une session
 * appartenant bien à `userId`, pour empêcher de révoquer la session d'un
 * autre utilisateur via un id deviné. Voir la remarque en haut du fichier :
 * effective au prochain chargement de page, pas instantanée.
 */
export async function revokeSession(userId: string, sessionId: string): Promise<boolean> {
  const result = await prisma.session.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}

/**
 * Utilisé par app/layout.tsx pour savoir si la session en cours a été
 * révoquée (bouton "déconnecter cet appareil" actionné depuis un autre
 * appareil). Retourne `false` (jamais révoquée) si jti est absent — cas des
 * jetons émis avant l'ajout de ce champ, ou si la ligne Session n'a jamais
 * pu être créée (best-effort, voir createSessionRecord) : dans le doute, on
 * ne bloque pas un utilisateur légitime pour une contrainte purement
 * best-effort.
 */
export async function isSessionRevoked(jti: string | undefined): Promise<boolean> {
  if (!jti) return false;
  try {
    const session = await prisma.session.findUnique({ where: { jti } });
    if (!session) return false; // pas de ligne (ancien jeton, ou création best-effort ratée) => pas bloquant
    return session.revokedAt !== null;
  } catch (error) {
    console.error("isSessionRevoked error:", error);
    return false; // fail-open — même politique que lib/features.ts
  }
}

/** Supprime la ligne Session au logout — pas juste une révocation, un vrai nettoyage. */
export async function deleteSessionRecord(jti: string | undefined): Promise<void> {
  if (!jti) return;
  try {
    await prisma.session.delete({ where: { jti } });
  } catch {
    // jti déjà absent (jeton pré-existant, ou déjà supprimé) — rien à faire.
  }
}
