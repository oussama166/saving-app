import { prisma } from '@/lib/prisma';
import { notifyRefresh } from '@/lib/sse';

// Pas de cron serveur (contrainte hébergement gratuit) : le "prélèvement"
// mensuel d'un abonnement est simulé par un rattrapage (catch-up) déclenché
// à chaque chargement de la liste d'abonnements ou du dashboard. On calcule
// tous les mois écoulés depuis le dernier prélèvement enregistré
// (lastChargedYearMonth) jusqu'au mois courant, et on crée une Transaction
// dépense pour chacun, datée du jour réel de prélèvement (pas "aujourd'hui")
// — donc l'historique reste correct même si l'utilisateur ne se connecte
// pas exactement le jour J.

const MAX_CATCHUP_MONTHS = 36; // garde-fou anti-boucle pour un abonnement oublié très longtemps

function formatYearMonth(year: number, month1to12: number): string {
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
  const subscriptions = await prisma.subscription.findMany({
    where: { userId, isActive: true },
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

      await prisma.$transaction(async (tx) => {
        await tx.transaction.create({
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
        });
        await tx.account.update({
          where: { id: sub.accountId },
          data: { balance: { increment: amount } },
        });
        await tx.subscription.update({
          where: { id: sub.id },
          data: { lastChargedYearMonth: yearMonthKey },
        });
      });

      createdCount += 1;
      const next = nextYearMonth(year, month);
      year = next.year;
      month = next.month;
    }
  }

  if (createdCount > 0) notifyRefresh();

  return createdCount;
}
