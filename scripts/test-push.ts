/**
 * Envoie une notification push de test à un utilisateur, sans passer par le
 * flux réel (rappel d'abonnement dû dans 2-5j) — utile pour vérifier que la
 * chaîne complète (clés VAPID, abonnement enregistré en base, service
 * worker) fonctionne avant de compter dessus en prod.
 *
 * Prérequis : l'utilisateur doit avoir cliqué "Activer" sous Profil >
 * Notifications push au moins une fois (sinon aucun PushSubscription en
 * base, la fonction ne fait rien silencieusement).
 *
 * Usage :
 *   npx tsx scripts/test-push.ts ton@email.com
 */
// Doit être le tout premier import (voir même remarque dans create-admin.ts
// et run-migrations.ts) — sans ça, TURSO_DATABASE_URL n'est jamais lu
// depuis .env et ce script cible silencieusement dev.db local.
import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { sendPushToUser } from '../lib/webPush';

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npx tsx scripts/test-push.ts ton@email.com');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`Aucun utilisateur avec l'email ${email}`);
    process.exit(1);
  }

  const subCount = await prisma.pushSubscription.count({ where: { userId: user.id } });
  if (subCount === 0) {
    console.error(
      `${email} n'a aucun appareil abonné aux notifications push — va sur /profil et clique "Activer" d'abord.`,
    );
    process.exit(1);
  }

  await sendPushToUser(user.id, {
    title: 'Test WealthOS',
    body: 'Les notifications push fonctionnent 🎉',
    url: '/',
  });

  console.log(`Notification de test envoyée à ${email} (${subCount} appareil(s) abonné(s)).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
