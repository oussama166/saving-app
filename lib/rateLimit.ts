// Anti brute-force minimal, en mémoire process (pas de dépendance DB/Redis —
// suffisant pour un déploiement mono-instance sur hébergement gratuit).
// Fenêtre glissante par clé (ex: email normalisé + IP) : au-delà de
// MAX_ATTEMPTS échecs dans WINDOW_MS, les tentatives suivantes sont bloquées
// jusqu'à expiration de la fenêtre.

type Bucket = { count: number; firstAttemptAt: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

// Purge périodique pour éviter une fuite mémoire sur les process longue durée.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.firstAttemptAt > WINDOW_MS) buckets.delete(key);
  }
}, WINDOW_MS).unref?.();

export function getRateLimitKey(identifier: string, req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
  return `${identifier.trim().toLowerCase()}::${ip}`;
}

/**
 * Vérifie si la clé est actuellement bloquée. Ne consomme pas de tentative —
 * à appeler avant de tenter l'authentification.
 */
export function isRateLimited(key: string): { limited: boolean; retryAfterSeconds?: number } {
  const bucket = buckets.get(key);
  if (!bucket) return { limited: false };

  const elapsed = Date.now() - bucket.firstAttemptAt;
  if (elapsed > WINDOW_MS) {
    buckets.delete(key);
    return { limited: false };
  }

  if (bucket.count >= MAX_ATTEMPTS) {
    return { limited: true, retryAfterSeconds: Math.ceil((WINDOW_MS - elapsed) / 1000) };
  }

  return { limited: false };
}

/** À appeler après un échec d'authentification pour incrémenter le compteur. */
export function recordFailedAttempt(key: string): void {
  const bucket = buckets.get(key);
  const now = Date.now();
  if (!bucket || now - bucket.firstAttemptAt > WINDOW_MS) {
    buckets.set(key, { count: 1, firstAttemptAt: now });
    return;
  }
  bucket.count += 1;
}

/** À appeler après une authentification réussie pour réinitialiser le compteur. */
export function clearAttempts(key: string): void {
  buckets.delete(key);
}
