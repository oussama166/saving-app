import { prisma } from '@/lib/prisma';
import { notifyRefresh } from '@/lib/sse';
import { checkAndSendBudgetAlert } from '@/lib/budgetAlerts';
import { getHouseholdMemberIds } from '@/lib/household';
import { sendSubscriptionReminderEmail } from '@/lib/email';
import { sendPushToUser } from '@/lib/webPush';

// Fenêtre de rappel avant prélèvement : 2 à 5 jours avant getNextBillingDate
// (voir demande utilisateur — "un rappel 2 à 5 jours avant le prochain
// prélèvement", pour avoir le temps de suspendre/annuler avant d'être
// débité). MIN <= daysUntil <= MAX.
const REMINDER_MIN_DAYS = 2;
const REMINDER_MAX_DAYS = 5;

// Pas de cron serveur (contrainte hébergement gratuit) : le "prélèvement"
// mensuel d'un abonnement est simulé par un rattrapage (catch-up) déclenché
// à chaque chargement de la liste d'abonnements ou du dashboard. On calcule
// tous les mois écoulés depuis le dernier prélèvement enregistré
// (lastChargedYearMonth) jusqu'au mois courant, et on crée une Transaction
// dépense pour chacun, datée du jour réel de prélèvement (pas "aujourd'hui")
// — donc l'historique reste correct même si l'utilisateur ne se connecte
// pas exactement le jour J.

const MAX_CATCHUP_MONTHS = 36; // garde-fou anti-boucle pour un abonnement oublié très longtemps

export function formatYearMonth(year: number, month1to12: number): string {
  return `${year}-${String(month1to12).padStart(2, '0')}`;
}

function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

function nextYearMonth(year: number, month1to12: number): { year: number; month: number } {
  return month1to12 === 12 ? { year: year + 1, month: 1 } : { year, month: month1to12 + 1 };
}

/**
 * Date du prélèvement pour un (year, month) donné — le jour du mois est
 * plafonné à la longueur réelle du mois (ex: billingDay=31 sur un mois de 30
 * jours -> dernier jour du mois).
 */
function billingDateFor(year: number, month1to12: number, billingDay: number): Date {
  const day = Math.min(billingDay, daysInMonth(year, month1to12));
  return new Date(year, month1to12 - 1, day, 12, 0, 0); // midi pour éviter tout souci de fuseau/DST
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

// Un prélèvement réel n'arrive presque jamais pile le jour "billingDay"
// configuré (délai bancaire, weekend, jour férié...) — tolérance ±5 jours,
// même esprit que la détection "autoPaid" des factures manuelles (voir
// lib/billCalendar.ts, fenêtre -3/+7).
function amountsAreClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.05);
}

function namesLooselyMatch(a: string, b: string): boolean {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

export interface SubscriptionLike {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string;
  name: string;
  subCategory: string | null;
  price: number;
  billingDay: number;
  isActive: boolean;
  lastChargedYearMonth: string | null;
  createdAt: Date;
}

/**
 * Calcule le prochain prélèvement à venir (ou le prélèvement du mois courant
 * s'il n'a pas encore eu lieu) pour affichage dans l'UI — ne modifie rien en
 * base, contrairement à catchUpSubscriptionCharges.
 */
export function getNextBillingDate(sub: SubscriptionLike, from: Date = new Date()): Date {
  let year = from.getFullYear();
  let month = from.getMonth() + 1;

  const thisMonthDate = billingDateFor(year, month, sub.billingDay);
  const thisMonthKey = formatYearMonth(year, month);
  const alreadyChargedThisMonth = sub.lastChargedYearMonth === thisMonthKey;

  if (!alreadyChargedThisMonth && thisMonthDate >= new Date(from.getFullYear(), from.getMonth(), from.getDate())) {
    return thisMonthDate;
  }

  const next = nextYearMonth(year, month);
  year = next.year;
  month = next.month;
  return billingDateFor(year, month, sub.billingDay);
}

/**
 * Rattrape les prélèvements manqués pour TOUS les abonnements actifs d'un
 * utilisateur : crée une Transaction dépense pour chaque mois écoulé sans
 * charge enregistrée (jusqu'au mois courant inclus si le jour de
 * prélèvement est déjà passé), et met à jour lastChargedYearMonth +
 * account.balance en conséquence. Idempotent — sûr à appeler à chaque
 * chargement de page.
 */
export async function catchUpSubscriptionCharges(userId: string): Promise<number> {
  const memberIds = await getHouseholdMemberIds(userId);
  const subscriptions = await prisma.subscription.findMany({
    where: { userId: { in: memberIds }, isActive: true },
  });

  const today = new Date();
  today.setHours(23, 59, 59, 999); // inclut tout le jour courant
  let createdCount = 0;

  for (const sub of subscriptions) {
    let { year, month } = sub.lastChargedYearMonth
      ? nextYearMonth(
          Number(sub.lastChargedYearMonth.slice(0, 4)),
          Number(sub.lastChargedYearMonth.slice(5, 7)),
        )
      : { year: sub.createdAt.getFullYear(), month: sub.createdAt.getMonth() + 1 };

    let iterations = 0;
    while (iterations < MAX_CATCHUP_MONTHS) {
      iterations += 1;
      const chargeDate = billingDateFor(year, month, sub.billingDay);
      if (chargeDate > today) break; // mois futur — on s'arrête là

      const yearMonthKey = formatYearMonth(year, month);
      const amount = -Math.abs(sub.price);

      // Avant de créer un prélèvement fictif, on cherche si une VRAIE
      // transaction pour ce mois existe déjà (import CSV, saisie manuelle,
      // webhook SMS...) — un prélèvement réel tombe rarement pile sur
      // billingDay, donc chercher une correspondance exacte à cette date ne
      // suffit pas. Fenêtre ±5 jours, même compte, pas déjà liée à un
      // abonnement, montant ou nom de marchand proche. Sans cette
      // vérification, on créait un doublon fictif à chaque fois qu'un
      // abonnement était ajouté/importé après coup pour un paiement déjà
      // présent dans l'historique — voir le signalement utilisateur.
      const candidates = await prisma.transaction.findMany({
        where: {
          userId: sub.userId,
          accountId: sub.accountId,
          subscriptionId: null,
          date: { gte: addDays(chargeDate, -5), lte: addDays(chargeDate, 5) },
        },
      });
      const existing = candidates.find(
        (t: { amount: number; merchant: string }) =>
          amountsAreClose(t.amount, amount) || namesLooselyMatch(t.merchant, sub.name),
      );

      // $transaction([...]) (forme "batch", pas la forme interactive
      // `async (tx) => {...}`) : les écritures ne dépendent pas du résultat
      // les unes des autres, donc pas besoin de callback. La forme
      // interactive a des soucis de fiabilité connus contre l'adapter
      // libSQL/Turso à distance (erreurs "TRANSACTION_CLOSED", voir
      // prisma/prisma#21345) — la forme batch envoie les requêtes groupées
      // sans dépendre d'une connexion tenue ouverte entre elles, donc plus
      // robuste ici tout en gardant l'atomicité.
      if (existing) {
        // Rattache la transaction réelle déjà présente à l'abonnement au
        // lieu d'en créer une fictive — pas de mouvement de solde ici, le
        // vrai paiement l'a déjà décrémenté au moment de son import/saisie.
        await prisma.$transaction([
          prisma.transaction.update({
            where: { id: existing.id },
            data: { subscriptionId: sub.id },
          }),
          prisma.subscription.update({
            where: { id: sub.id },
            data: { lastChargedYearMonth: yearMonthKey },
          }),
        ]);
      } else {
        await prisma.$transaction([
          prisma.transaction.create({
            data: {
              userId: sub.userId,
              accountId: sub.accountId,
              categoryId: sub.categoryId,
              subCategory: sub.subCategory,
              paymentMethod: null,
              merchant: sub.name,
              amount,
              date: chargeDate,
              subscriptionId: sub.id,
            },
          }),
          prisma.account.update({
            where: { id: sub.accountId },
            data: { balance: { increment: amount } },
          }),
          prisma.subscription.update({
            where: { id: sub.id },
            data: { lastChargedYearMonth: yearMonthKey },
          }),
        ]);
      }

      await checkAndSendBudgetAlert(sub.userId, sub.categoryId, chargeDate);

      createdCount += 1;
      const next = nextYearMonth(year, month);
      year = next.year;
      month = next.month;
    }
  }

  if (createdCount > 0) notifyRefresh();

  return createdCount;
}

function daysUntil(target: Date, from: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export interface UpcomingReminder {
  subscriptionId: string;
  name: string;
  price: number;
  nextBillingDate: Date;
  daysUntil: number;
}

/**
 * Abonnements actifs de l'utilisateur (foyer) dont le prochain prélèvement
 * tombe dans la fenêtre de rappel (2 à 5 jours) — utilisé par la bannière de
 * la page Abonnements ET par le cron d'envoi d'email (mêmes bornes que
 * REMINDER_MIN_DAYS/REMINDER_MAX_DAYS ci-dessus).
 */
export async function getUpcomingSubscriptionReminders(
  userId: string,
  from: Date = new Date(),
): Promise<UpcomingReminder[]> {
  const memberIds = await getHouseholdMemberIds(userId);
  const subscriptions = await prisma.subscription.findMany({
    where: { userId: { in: memberIds }, isActive: true },
  });

  return subscriptions
    .map((sub) => {
      const nextBillingDate = getNextBillingDate(sub, from);
      return { sub, nextBillingDate, daysUntil: daysUntil(nextBillingDate, from) };
    })
    .filter(({ daysUntil: d }) => d >= REMINDER_MIN_DAYS && d <= REMINDER_MAX_DAYS)
    .map(({ sub, nextBillingDate, daysUntil: d }) => ({
      subscriptionId: sub.id,
      name: sub.name,
      price: sub.price,
      nextBillingDate,
      daysUntil: d,
    }));
}

/**
 * Envoie un email de rappel pour chaque abonnement actif (tous utilisateurs)
 * dont le prochain prélèvement tombe dans 2 à 5 jours — appelé par le cron
 * externe /api/cron/subscription-reminders (voir ce fichier pour la
 * protection x-cron-secret, Vercel Hobby ne garantit pas de cron interne
 * fiable, même contrainte que catchUpSubscriptionCharges/checkAndSendBudgetAlert).
 * Idempotent : une seule notification par (abonnement, mois de prélèvement),
 * via SubscriptionReminderSent — create() AVANT l'envoi de l'email, même
 * garde-fou anti-boucle que checkAndSendBudgetAlert si Resend est en panne.
 */
export async function sendDueSubscriptionReminders(): Promise<{ sent: number; skipped: number }> {
  const today = new Date();
  const subscriptions = await prisma.subscription.findMany({
    where: { isActive: true },
  });

  let sent = 0;
  let skipped = 0;

  for (const sub of subscriptions) {
    const nextBillingDate = getNextBillingDate(sub, today);
    const d = daysUntil(nextBillingDate, today);
    if (d < REMINDER_MIN_DAYS || d > REMINDER_MAX_DAYS) continue;

    const yearMonthKey = formatYearMonth(nextBillingDate.getFullYear(), nextBillingDate.getMonth() + 1);

    const alreadySent = await prisma.subscriptionReminderSent.findUnique({
      where: { subscriptionId_yearMonth: { subscriptionId: sub.id, yearMonth: yearMonthKey } },
    });
    if (alreadySent) {
      skipped += 1;
      continue;
    }

    // Budget partagé : rappel envoyé à tous les membres du foyer, pas
    // seulement au créateur de l'abonnement (même logique que
    // checkAndSendBudgetAlert — le partenaire doit aussi savoir qu'un
    // prélèvement commun arrive).
    const memberIds = await getHouseholdMemberIds(sub.userId);
    const members = await prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, email: true },
    });
    if (members.length === 0) continue;

    await prisma.subscriptionReminderSent.create({
      data: { userId: sub.userId, subscriptionId: sub.id, yearMonth: yearMonthKey },
    });

    await Promise.all(
      members.map((m) =>
        Promise.all([
          sendSubscriptionReminderEmail(m.email, {
            name: sub.name,
            price: sub.price,
            nextBillingDate,
            daysUntil: d,
          }),
          // Canal additionnel (voir lib/webPush.ts) — dégradé silencieusement
          // sans clés VAPID ou si l'utilisateur n'a aucun appareil abonné.
          sendPushToUser(m.id, {
            title: `Prélèvement à venir : ${sub.name}`,
            body: `${sub.price} MAD dans ${d} jour${d > 1 ? 's' : ''} (${nextBillingDate.toLocaleDateString('fr-FR')})`,
            url: '/abonnements',
          }),
        ]),
      ),
    );
    sent += 1;
  }

  return { sent, skipped };
}
