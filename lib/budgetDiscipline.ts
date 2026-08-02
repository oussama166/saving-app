import { prisma } from '@/lib/prisma';
import type { HouseholdContext } from '@/lib/household';

// Score de discipline budgétaire — historique de DailyBudgetSnapshot (voir
// schema.prisma) : à quelle fréquence le foyer est-il resté sous le budget
// journalier sécuritaire calculé par lib/billCalendar.ts ? Une ligne par jour
// et par foyer (userId = ctx.budgetOwnerId, pas par membre individuel — même
// convention que UserSettings), capturée à chaque chargement de la page
// Calendrier plutôt que via un cron (pas d'hébergement payant, voir
// catchUpSubscriptionCharges pour le même principe côté abonnements).

function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

/**
 * Enregistre/actualise la photo du jour (budget calculé + réalisé). Idempotent
 * (upsert sur userId+date) — appelée à chaque GET /api/calendar ou
 * /api/calendar/today, donc plusieurs fois par jour tant que la journée n'est
 * pas terminée : chaque appel affine `spentMad` avec les dernières
 * transactions. Une fois le jour passé, plus aucun appel ne le touche => la
 * ligne reste figée comme historique.
 */
export async function captureDailyBudgetSnapshot(
  ctx: HouseholdContext,
  safeDailySpendMad: number,
  spentMad: number,
): Promise<void> {
  const today = atMidnight(new Date());
  await prisma.dailyBudgetSnapshot.upsert({
    where: { userId_date: { userId: ctx.budgetOwnerId, date: today } },
    update: { safeDailySpendMad, spentMad },
    create: { userId: ctx.budgetOwnerId, date: today, safeDailySpendMad, spentMad },
  });
}

export interface BudgetDisciplineScore {
  totalDays: number;
  daysOnBudget: number;
  scorePct: number; // 0-100, null-safe (0 si aucun historique)
  worstWeekday: { key: WeekdayKey; overspendRatePct: number } | null;
  recentDays: { date: string; safeDailySpendMad: number; spentMad: number; onBudget: boolean }[];
}

/**
 * Score sur les `days` derniers jours d'historique (jour courant exclu — pas
 * encore terminé, donc pas comparable). `worstWeekday` repère le jour de la
 * semaine où le dépassement est le plus fréquent (ex: "sat" si le foyer
 * dépasse son budget le samedi plus souvent qu'ailleurs) — nécessite au moins
 * 3 occurrences de ce jour de semaine dans l'historique pour être significatif,
 * sinon retourne null plutôt qu'un signal bruité.
 */
export async function getBudgetDisciplineScore(ctx: HouseholdContext, days = 90): Promise<BudgetDisciplineScore> {
  const today = atMidnight(new Date());
  const from = new Date(today);
  from.setDate(from.getDate() - days);

  const snapshots = await prisma.dailyBudgetSnapshot.findMany({
    where: { userId: ctx.budgetOwnerId, date: { gte: from, lt: today } },
    orderBy: { date: 'asc' },
  });

  if (snapshots.length === 0) {
    return { totalDays: 0, daysOnBudget: 0, scorePct: 0, worstWeekday: null, recentDays: [] };
  }

  const totalDays = snapshots.length;
  const daysOnBudget = snapshots.filter(
    (s: { spentMad: number; safeDailySpendMad: number }) => s.spentMad <= s.safeDailySpendMad,
  ).length;
  const scorePct = Math.round((daysOnBudget / totalDays) * 100);

  const byWeekday = new Map<number, { total: number; over: number }>();
  for (const s of snapshots as { date: Date; spentMad: number; safeDailySpendMad: number }[]) {
    const wd = s.date.getDay();
    const entry = byWeekday.get(wd) ?? { total: 0, over: 0 };
    entry.total += 1;
    if (s.spentMad > s.safeDailySpendMad) entry.over += 1;
    byWeekday.set(wd, entry);
  }

  let worstWeekday: BudgetDisciplineScore['worstWeekday'] = null;
  let worstRate = -1;
  for (const [wd, { total, over }] of byWeekday.entries()) {
    if (total < 3) continue; // pas assez d'occurrences pour être significatif
    const rate = (over / total) * 100;
    if (rate > worstRate) {
      worstRate = rate;
      worstWeekday = { key: WEEKDAY_KEYS[wd], overspendRatePct: Math.round(rate) };
    }
  }

  const recentDays = snapshots
    .slice(-14)
    .map((s: { date: Date; safeDailySpendMad: number; spentMad: number }) => ({
      date: s.date.toISOString(),
      safeDailySpendMad: s.safeDailySpendMad,
      spentMad: s.spentMad,
      onBudget: s.spentMad <= s.safeDailySpendMad,
    }));

  return { totalDays, daysOnBudget, scorePct, worstWeekday, recentDays };
}
