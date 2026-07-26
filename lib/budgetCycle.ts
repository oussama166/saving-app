import { prisma } from '@/lib/prisma';
import type { HouseholdContext } from '@/lib/household';

interface PayDaySettings {
  budgetCycleStartDay: number;
}

// Fenêtre de tolérance (en jours) autour du jour de paie configuré dans
// laquelle on cherche la vraie transaction de salaire. Couvre le cas d'une
// paie qui tombe parfois un peu avant, parfois un peu après la date
// habituelle, sans obliger l'utilisateur à re-régler son réglage à chaque
// mois qui décale.
const TOLERANCE_DAYS = 7;

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/**
 * Repère par défaut du cycle en cours à partir du jour de paie configuré
 * (`payDay`, 1-28) : si on est déjà passé ce jour-ci dans le mois courant, le
 * cycle a commencé ce mois-ci ; sinon il a commencé le mois précédent. Le
 * jour est borné au nombre de jours réel du mois visé (utile seulement pour
 * des valeurs > 28, mais on borne quand même par sécurité).
 */
export function estimateCycleStart(payDay: number, referenceDate: Date = new Date()): Date {
  const day = referenceDate.getDate();
  let year = referenceDate.getFullYear();
  let month = referenceDate.getMonth();

  if (day < payDay) {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }

  const clampedDay = Math.min(payDay, daysInMonth(year, month));
  return new Date(year, month, clampedDay);
}

/**
 * Point de départ du "cycle budgétaire" en cours (utilisé à la place du 1er
 * calendaire par tout ce qui calcule "ce mois-ci" : score de santé,
 * cash-flow, budget détaillé par catégorie, alertes, digest, bilans).
 *
 * Logique hybride :
 * 1. `budgetCycleStartDay` (réglage Profil, défaut 1) donne une estimation
 *    du jour où le cycle démarre.
 * 2. Si ce réglage vaut 1 (comportement historique, personne ne l'a
 *    configuré), on reste sur le calendaire pur — pas de détection, pas de
 *    changement pour l'immense majorité des comptes.
 * 3. Sinon, on cherche la transaction de revenu réelle la plus proche de
 *    cette estimation (± TOLERANCE_DAYS, jamais dans le futur) et on
 *    l'utilise comme vrai point de départ. Sans salaire détecté pour ce
 *    cycle (pas encore reçu, ou pas encore saisi), on retombe sur
 *    l'estimation — jamais de blocage.
 *
 * `preloadedSettings` : passe le UserSettings déjà chargé par l'appelant
 * (ex: app/api/dashboard/route.ts, qui le récupère de toute façon pour le
 * revenu de référence) pour éviter une deuxième requête identique. Si non
 * fourni (undefined), ce helper fait sa propre requête.
 */
export async function resolveBudgetCycleStart(
  ctx: HouseholdContext,
  referenceDate: Date = new Date(),
  preloadedSettings?: PayDaySettings | null,
): Promise<Date> {
  const settings =
    preloadedSettings !== undefined
      ? preloadedSettings
      : await prisma.userSettings.findUnique({ where: { userId: ctx.budgetOwnerId } });
  const payDay = settings?.budgetCycleStartDay ?? 1;
  const estimated = estimateCycleStart(payDay, referenceDate);

  if (payDay <= 1) return estimated;

  const windowStart = addDays(estimated, -TOLERANCE_DAYS);
  const windowEndRaw = addDays(estimated, TOLERANCE_DAYS);
  const now = atMidnight(referenceDate);
  const windowEnd = windowEndRaw > now ? now : windowEndRaw;
  if (windowStart > windowEnd) return estimated;

  const candidates = await prisma.transaction.findMany({
    where: {
      userId: { in: ctx.memberIds },
      amount: { gt: 0 },
      category: { type: 'income' },
      date: { gte: windowStart, lte: windowEnd },
    },
    select: { date: true },
  });

  if (candidates.length === 0) return estimated;

  // La plus proche de l'estimation, pas la plus grosse : un remboursement
  // ponctuel plus élevé que le salaire ne doit pas fausser la détection.
  const closest = candidates.reduce((best, tx) =>
    Math.abs(tx.date.getTime() - estimated.getTime()) < Math.abs(best.date.getTime() - estimated.getTime())
      ? tx
      : best,
  );

  return atMidnight(closest.date);
}
