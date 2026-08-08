// Monitoring d'erreurs minimal — envoie les exceptions serveur non gérées
// vers Sentry via son API HTTP "store" appelée directement en fetch, plutôt
// que le SDK @sentry/nextjs (même philosophie que lib/email.ts pour Resend :
// éviter une dépendance lourde + la réécriture de next.config/instrumentation
// que demande le SDK officiel, pas justifiée pour une app perso
// mono-utilisateur). Dégradation propre si SENTRY_DSN est absent : log un
// avertissement UNE fois puis no-op silencieux — jamais bloquant, jamais
// d'exception levée depuis ce module (même garde-fou que sendEmail).
//
// Câblé automatiquement pour TOUTES les routes API et le rendu de pages via
// instrumentation.ts (hook onRequestError de Next.js) — pas besoin de
// modifier chaque route une par une.

let warnedMissingDsn = false;

export interface CaptureErrorContext {
  route?: string;
  userId?: string;
  extra?: Record<string, unknown>;
}

interface ParsedDsn {
  host: string;
  projectId: string;
  publicKey: string;
}

function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\//, '');
    if (!publicKey || !projectId || !url.host) return null;
    return { host: url.host, projectId, publicKey };
  } catch {
    return null;
  }
}

const FETCH_TIMEOUT_MS = 5000;

/**
 * Capture une erreur serveur : log toujours en local (console.error, comme
 * avant partout dans les routes API), et remonte en plus vers Sentry si
 * SENTRY_DSN est configuré. Ne lève jamais d'exception — un échec du
 * monitoring ne doit jamais aggraver l'erreur d'origine.
 */
export async function captureError(error: unknown, context: CaptureErrorContext = {}): Promise<void> {
  console.error(context.route ? `[${context.route}]` : '[error]', error);

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    if (!warnedMissingDsn) {
      console.warn(
        'errorMonitoring: SENTRY_DSN absent — les erreurs restent loguées en local uniquement (console), pas remontées à un service externe.',
      );
      warnedMissingDsn = true;
    }
    return;
  }

  const parsed = parseDsn(dsn);
  if (!parsed) {
    console.warn('errorMonitoring: SENTRY_DSN invalide — format attendu "https://<publicKey>@<host>/<projectId>".');
    return;
  }

  try {
    const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error));

    const payload = {
      event_id: crypto.randomUUID().replace(/-/g, ''),
      timestamp: new Date().toISOString(),
      platform: 'node',
      level: 'error',
      environment: process.env.NODE_ENV ?? 'development',
      server_name: 'wealthos',
      exception: {
        values: [
          {
            type: err.name || 'Error',
            value: err.message,
            stacktrace: err.stack
              ? { frames: err.stack.split('\n').slice(1).map((line) => ({ filename: line.trim() })).reverse() }
              : undefined,
          },
        ],
      },
      ...(context.route ? { tags: { route: context.route } } : {}),
      ...(context.userId ? { user: { id: context.userId } } : {}),
      ...(context.extra ? { extra: context.extra } : {}),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`https://${parsed.host}/api/${parsed.projectId}/store/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=wealthos/1.0`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) {
        console.warn(`errorMonitoring: Sentry a répondu ${res.status} — erreur non remontée.`);
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (sendError) {
    console.warn('errorMonitoring: envoi vers Sentry a échoué —', sendError instanceof Error ? sendError.message : sendError);
  }
}
