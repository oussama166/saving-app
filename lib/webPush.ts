import webpush from 'web-push';
import { prisma } from './prisma';

// Notifications push (PWA), canal ADDITIONNEL aux rappels email existants
// (voir lib/subscriptions.ts::sendDueSubscriptionReminders) — jamais un
// remplacement. Même philosophie de dégradation gracieuse que
// lib/email.ts (RESEND_API_KEY) et lib/errorMonitoring.ts (SENTRY_DSN) :
// sans clés VAPID configurées, on logue un avertissement une fois et on
// ne fait rien, sans jamais bloquer l'appelant.
let vapidConfigured = false;
let warnedMissingKeys = false;

function ensureConfigured(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:contact@wealthos.app';

  if (!publicKey || !privateKey) {
    if (!warnedMissingKeys) {
      console.warn(
        '[webPush] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY absents — notifications push désactivées (voir .env.example, génère-les avec `npx web-push generate-vapid-keys`).',
      );
      warnedMissingKeys = true;
    }
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

// Envoie une notification à tous les appareils abonnés d'un utilisateur.
// Ne jette jamais — un échec d'envoi push ne doit pas casser le flux
// appelant (ex: l'envoi de l'email de rappel doit continuer même si le
// push échoue). Les abonnements expirés/révoqués (404/410 côté navigateur)
// sont supprimés silencieusement pour ne pas ré-essayer indéfiniment.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        const result = await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
        // Un statusCode 2xx ici confirme juste que le SERVICE de push (FCM,
        // Mozilla push...) a accepté le message pour livraison — pas que le
        // navigateur l'a effectivement affiché (ça dépend ensuite des
        // permissions OS, du mode Ne pas déranger, etc., voir public/sw.js).
        console.log(`[webPush] Envoyé à ${sub.endpoint.slice(0, 60)}... — statusCode ${result.statusCode}`);
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error('[webPush] Envoi échoué pour', sub.endpoint, err);
        }
      }
    }),
  );
}
