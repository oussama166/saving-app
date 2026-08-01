import { prisma } from '@/lib/prisma';
import { getRatesToMad } from '@/lib/exchangeRates';
import { formatYearMonth } from '@/lib/subscriptions';
import type { HouseholdContext } from '@/lib/household';

// Calendrier unifié des paiements — agrège 4 sources déjà existantes qui ont
// chacune leur propre échéancier (Subscription.billingDay,
// RecurringTransfer.dayOfMonth, Debt.dueDay) plus les factures ajoutées à la
// main (Bill.dayOfMonth), en une seule liste d'événements avec un statut
// commun payé/à venir/en retard, et calcule un solde projeté jour par jour
// jusqu'à la prochaine paie (voir lib/budgetCycle.ts pour la même notion de
// "jour de paie" déjà utilisée ailleurs dans l'app).
//
// Les virements récurrents (RecurringTransfer) sont affichés sur le
// calendrier pour le suivi, mais N'AFFECTENT PAS le solde projeté
// (affectsBalance: false) : l'argent reste dans le foyer, il change juste de
// compte — même logique que category.type === 'transfer' exclu des agrégats
// revenus/dépenses ailleurs dans l'app (lib/financials.ts).

export type CalendarSourceType = 'subscription' | 'debt' | 'recurringTransfer' | 'bill';
export type CalendarStatus = 'paid' | 'upcoming' | 'late';

export interface CalendarEvent {
  id: string;
  sourceType: CalendarSourceType;
  sourceId: string;
  name: string;
  amountMad: number;
  dueDate: Date;
  status: CalendarStatus;
  affectsBalance: boolean;
}

export interface ProjectionPoint {
  date: Date;
  balanceMad: number;
  events: CalendarEvent[];
  /**
   * Budget dépense sécuritaire propre à CE jour (pas une moyenne globale) :
   * (solde au début du jour − échéances encore à venir de ce jour jusqu'à la
   * paie incluse) / jours restants à partir de ce jour. Se recalcule donc
   * naturellement au fil de la période — voir le commentaire détaillé sur
   * computeBalanceProjection.
   */
  safeDailySpendMad: number;
}

export interface BalanceProjection {
  points: ProjectionPoint[];
  startBalanceMad: number;
  nextPayday: Date;
  daysRemaining: number;
  committedOutflowMad: number;
  safeDailySpendMad: number;
}

function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

function dueDateFor(year: number, month1to12: number, day: number): Date {
  const clamped = Math.min(Math.max(day, 1), daysInMonth(year, month1to12));
  return new Date(year, month1to12 - 1, clamped);
}

function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function computeStatus(dueDate: Date, paid: boolean, today: Date): CalendarStatus {
  if (paid) return 'paid';
  return atMidnight(dueDate) < atMidnight(today) ? 'late' : 'upcoming';
}

/**
 * Prochain jour de paie (>= referenceDate) à partir du jour configuré
 * (UserSettings.budgetCycleStartDay, 1-28). payDay=1 (défaut, non configuré)
 * retombe toujours sur le 1er du mois suivant — même comportement que le
 * cycle calendaire classique ailleurs dans l'app.
 */
export function estimateNextPayday(payDay: number, referenceDate: Date = new Date()): Date {
  const day = referenceDate.getDate();
  let year = referenceDate.getFullYear();
  let month0 = referenceDate.getMonth();

  if (day >= payDay) {
    month0 += 1;
    if (month0 > 11) {
      month0 = 0;
      year += 1;
    }
  }

  return dueDateFor(year, month0 + 1, payDay);
}

/** Événements calendrier de toutes les sources pour un (année, mois) donné. */
export async function getMonthEvents(ctx: HouseholdContext, year: number, month1to12: number): Promise<CalendarEvent[]> {
  const currentYM = formatYearMonth(year, month1to12);
  const today = new Date();

  // Requêtes séparées (pas de Promise.all) : plus lisible à tracer, et évite
  // qu'un typage encore instable sur l'un des modèles ne dégrade l'inférence
  // de type des autres éléments d'un même tableau Promise.all.
  const subscriptions = await prisma.subscription.findMany({
    where: { userId: { in: ctx.memberIds }, isActive: true },
    include: { account: { select: { currency: true } } },
  });
  const debts = await prisma.debt.findMany({
    where: { userId: { in: ctx.memberIds }, isActive: true, dueDay: { not: null }, monthlyPayment: { gt: 0 } },
    include: { payments: true },
  });
  const transfers = await prisma.recurringTransfer.findMany({ where: { userId: { in: ctx.memberIds }, active: true } });
  const bills = await prisma.bill.findMany({ where: { userId: { in: ctx.memberIds }, isActive: true } });

  // RecurringTransfer n'a pas de relation Prisma déclarée vers Account (juste
  // fromAccountId/toAccountId en texte, voir schema.prisma) — on résout les
  // comptes séparément plutôt que via `include`.
  const transferAccountIds = Array.from(
    new Set(transfers.flatMap((t: { fromAccountId: string; toAccountId: string }) => [t.fromAccountId, t.toAccountId])),
  );
  const transferAccounts = transferAccountIds.length
    ? await prisma.account.findMany({ where: { id: { in: transferAccountIds } }, select: { id: true, name: true, currency: true } })
    : [];
  const accountById = new Map(transferAccounts.map((a) => [a.id, a]));

  const currencies: string[] = [
    ...subscriptions.map((s: { account: { currency: string } }) => s.account.currency),
    ...transferAccounts.map((a) => a.currency),
  ];
  const rates = await getRatesToMad(currencies);

  const events: CalendarEvent[] = [];

  for (const sub of subscriptions) {
    const dueDate = dueDateFor(year, month1to12, sub.billingDay);
    const paid = sub.lastChargedYearMonth === currentYM;
    events.push({
      id: `subscription:${sub.id}`,
      sourceType: 'subscription',
      sourceId: sub.id,
      name: sub.name,
      amountMad: sub.price * (rates[sub.account.currency] ?? 1),
      dueDate,
      status: computeStatus(dueDate, paid, today),
      affectsBalance: true,
    });
  }

  for (const debt of debts) {
    if (!debt.dueDay) continue;
    const dueDate = dueDateFor(year, month1to12, debt.dueDay);
    const paid = debt.payments.some(
      (p: { date: Date }) => p.date.getFullYear() === year && p.date.getMonth() + 1 === month1to12,
    );
    events.push({
      id: `debt:${debt.id}`,
      sourceType: 'debt',
      sourceId: debt.id,
      name: debt.name,
      amountMad: debt.monthlyPayment,
      dueDate,
      status: computeStatus(dueDate, paid, today),
      affectsBalance: true,
    });
  }

  for (const rt of transfers) {
    const fromAccount = accountById.get(rt.fromAccountId);
    const toAccount = accountById.get(rt.toAccountId);
    if (!fromAccount || !toAccount) continue; // compte supprimé entretemps — ignore plutôt que planter
    const dueDate = dueDateFor(year, month1to12, rt.dayOfMonth);
    const paid = rt.lastRunCycle === currentYM;
    events.push({
      id: `recurringTransfer:${rt.id}`,
      sourceType: 'recurringTransfer',
      sourceId: rt.id,
      name: `${fromAccount.name} → ${toAccount.name}`,
      amountMad: rt.amount * (rates[fromAccount.currency] ?? 1),
      dueDate,
      status: computeStatus(dueDate, paid, today),
      affectsBalance: false,
    });
  }

  for (const bill of bills) {
    const dueDate = dueDateFor(year, month1to12, bill.dayOfMonth);
    const manuallyPaid = bill.manuallyPaidYearMonth === currentYM;
    let autoPaid = false;
    if (!manuallyPaid && bill.categoryId) {
      const match = await prisma.transaction.findFirst({
        where: {
          userId: { in: ctx.memberIds },
          categoryId: bill.categoryId,
          date: { gte: addDays(dueDate, -3), lte: addDays(dueDate, 7) },
        },
        select: { id: true },
      });
      autoPaid = Boolean(match);
    }
    events.push({
      id: `bill:${bill.id}`,
      sourceType: 'bill',
      sourceId: bill.id,
      name: bill.name,
      amountMad: bill.amount,
      dueDate,
      status: computeStatus(dueDate, manuallyPaid || autoPaid, today),
      affectsBalance: true,
    });
  }

  return events.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

/**
 * Solde projeté jour par jour depuis aujourd'hui jusqu'à la prochaine paie
 * (incluse), en déduisant du solde actuel DÉPENSABLE du foyer chaque
 * échéance non payée qui affecte le solde (affectsBalance: true — les
 * virements internes sont exclus, voir l'en-tête du fichier).
 *
 * "Solde actuel dépensable" = comptes courants (type 'checking') UNIQUEMENT,
 * moins l'épargne déjà verrouillée dans des objectifs (SavingsGoal) — les
 * comptes 'savings'/'investment' ne sont PAS inclus, même logique que le
 * "Solde Sécuritaire Global" du Dashboard (voir safeToSpend dans
 * app/api/dashboard/route.ts). Compter l'épargne ici gonflerait
 * artificiellement le budget journalier avec de l'argent qui n'est pas censé
 * être dépensé au jour le jour.
 */
export async function computeBalanceProjection(ctx: HouseholdContext, payDay: number): Promise<BalanceProjection> {
  const [checkingAccounts, savingsGoals] = await Promise.all([
    prisma.account.findMany({ where: { userId: { in: ctx.memberIds }, type: 'checking' } }),
    prisma.savingsGoal.findMany({ where: { userId: { in: ctx.memberIds } }, select: { currentAmount: true } }),
  ]);
  const rates = await getRatesToMad(checkingAccounts.map((a: { currency: string }) => a.currency));
  const totalCheckingMad = checkingAccounts.reduce(
    (acc: number, a: { balance: number; currency: string }) => acc + a.balance * (rates[a.currency] ?? 1),
    0,
  );
  // SavingsGoal.currentAmount est déjà exprimé en MAD (montant "objectif",
  // pas lié à la devise d'un compte) — même hypothèse que
  // app/api/dashboard/route.ts.
  const totalSavingsLockedMad = savingsGoals.reduce((acc: number, g: { currentAmount: number }) => acc + g.currentAmount, 0);
  const startBalanceMad = Math.max(0, totalCheckingMad - totalSavingsLockedMad);

  const today = atMidnight(new Date());
  const nextPayday = estimateNextPayday(payDay, today);

  // Couvre tous les (année, mois) traversés entre aujourd'hui et la
  // prochaine paie (généralement 1, parfois 2 si la fenêtre chevauche un
  // changement de mois).
  const monthsToFetch = new Set<string>();
  for (let cursor = new Date(today); cursor <= nextPayday; cursor = addDays(cursor, 1)) {
    monthsToFetch.add(`${cursor.getFullYear()}-${cursor.getMonth() + 1}`);
  }

  const eventsByMonth = await Promise.all(
    Array.from(monthsToFetch).map((ym) => {
      const [y, m] = ym.split('-').map(Number);
      return getMonthEvents(ctx, y, m);
    }),
  );
  const allEvents = eventsByMonth.flat();

  const relevantEvents = allEvents.filter(
    (e) => e.affectsBalance && e.status !== 'paid' && e.dueDate >= today && e.dueDate <= nextPayday,
  );

  // Scénario jour par jour : à chaque jour D, le budget dépense sécuritaire
  // de CE jour est recalculé à partir du solde disponible au début de D
  // (donc APRÈS les échéances des jours précédents, AVANT celles de D) moins
  // les échéances qui restent encore à payer entre D et la paie incluse, le
  // tout réparti sur le nombre de jours restants à partir de D. Le premier
  // point du tableau (aujourd'hui) redonne exactement l'ancien calcul global
  // (une seule moyenne) — les jours suivants affinent ce chiffre au fur et à
  // mesure que des échéances passent, plutôt que d'étaler une moyenne fixe
  // sur toute la période. Purement déterministe — sert d'input chiffré à la
  // route Coach IA (/api/coach/calendar-outlook), qui ne fait QUE commenter
  // ces chiffres, jamais les recalculer elle-même.
  const points: ProjectionPoint[] = [];
  let runningBalance = startBalanceMad;
  for (let cursor = new Date(today); cursor <= nextPayday; cursor = addDays(cursor, 1)) {
    const balanceBeforeToday = runningBalance;
    const eventsToday = relevantEvents.filter((e) => isSameDay(e.dueDate, cursor));
    for (const e of eventsToday) runningBalance -= e.amountMad;

    const committedFromCursor = relevantEvents
      .filter((e) => atMidnight(e.dueDate) >= cursor)
      .reduce((acc, e) => acc + e.amountMad, 0);
    const daysFromCursor = Math.max(
      1,
      Math.round((nextPayday.getTime() - cursor.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    );
    const safeDailySpendMadForDay = Math.max(0, balanceBeforeToday - committedFromCursor) / daysFromCursor;

    points.push({
      date: new Date(cursor),
      balanceMad: runningBalance,
      events: eventsToday,
      safeDailySpendMad: safeDailySpendMadForDay,
    });
  }

  const daysRemaining = Math.max(
    1,
    Math.round((nextPayday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );
  const committedOutflowMad = relevantEvents.reduce((acc, e) => acc + e.amountMad, 0);
  // Le chiffre "du jour" affiché en haut de la carte Coach IA est celui
  // d'aujourd'hui — identique au premier point de la série (voir plus haut).
  const safeDailySpendMad = points[0]?.safeDailySpendMad ?? 0;

  return { points, startBalanceMad, nextPayday, daysRemaining, committedOutflowMad, safeDailySpendMad };
}

/**
 * Dépenses réelles déjà enregistrées AUJOURD'HUI, hors montants déjà comptés
 * comme échéances (abonnements/dettes/factures) — ces derniers ont déjà
 * réduit le solde du compte (donc déjà pris en compte par
 * computeBalanceProjection via startBalanceMad), les recompter ici comme
 * "dépense discrétionnaire" ferait doublon et fausserait la comparaison
 * avec safeDailySpendMad. Sert de "réalisé du jour" pour le widget Dashboard,
 * la carte Coach IA et l'alerte de saisie.
 *
 * Exclusions :
 * - Transaction.subscriptionId renseigné -> générée automatiquement par un
 *   abonnement (voir lib/subscriptions.ts).
 * - Transaction liée à un DebtPayment -> remboursement de dette.
 * - Transaction dans la catégorie d'une facture manuelle (Bill) dont la
 *   fenêtre de rapprochement (jour dû -3 à +7, même logique que
 *   getMonthEvents) couvre aujourd'hui.
 */
export async function getTodayDiscretionarySpendMad(ctx: HouseholdContext): Promise<number> {
  const today = atMidnight(new Date());
  const tomorrow = addDays(today, 1);

  const bills = await prisma.bill.findMany({
    where: { userId: { in: ctx.memberIds }, isActive: true, categoryId: { not: null } },
  });
  const excludedCategoryIds = new Set(
    bills
      .filter((b: { dayOfMonth: number }) => {
        const dueDate = dueDateFor(today.getFullYear(), today.getMonth() + 1, b.dayOfMonth);
        return today >= addDays(dueDate, -3) && today <= addDays(dueDate, 7);
      })
      .map((b: { categoryId: string | null }) => b.categoryId as string),
  );

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: { in: ctx.memberIds },
      date: { gte: today, lt: tomorrow },
      category: { type: 'expense' },
      subscriptionId: null,
      debtPayment: null,
    },
    select: { amount: true, categoryId: true, account: { select: { currency: true } } },
  });

  const discretionary = transactions.filter(
    (t: { categoryId: string }) => !excludedCategoryIds.has(t.categoryId),
  );
  if (discretionary.length === 0) return 0;

  const currencies: string[] = discretionary.map((t: { account: { currency: string } }) => t.account.currency);
  const rates = await getRatesToMad(currencies);
  return discretionary.reduce(
    (acc: number, t: { amount: number; account: { currency: string } }) =>
      acc + Math.abs(t.amount) * (rates[t.account.currency] ?? 1),
    0,
  );
}

export interface CategoryBudgetShare {
  categoryId: string;
  categoryName: string;
  shareMad: number;
}

/**
 * Répartit un montant (typiquement le safeDailySpendMad du jour) en
 * sous-plafonds indicatifs par catégorie, selon les proportions RÉELLES des
 * dépenses discrétionnaires (hors abonnements/dettes/catégories de facture)
 * des `months` derniers mois. Purement indicatif — n'affecte jamais le
 * calcul du budget total, juste sa ventilation à l'affichage.
 */
export async function getDiscretionaryCategoryBreakdown(
  ctx: HouseholdContext,
  amountToSplitMad: number,
  months = 3,
): Promise<CategoryBudgetShare[]> {
  if (amountToSplitMad <= 0) return [];

  const from = new Date();
  from.setMonth(from.getMonth() - months);

  const bills = await prisma.bill.findMany({
    where: { userId: { in: ctx.memberIds }, isActive: true, categoryId: { not: null } },
    select: { categoryId: true },
  });
  const billCategoryIds = new Set(bills.map((b: { categoryId: string | null }) => b.categoryId as string));

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: { in: ctx.memberIds },
      date: { gte: from },
      category: { type: 'expense' },
      subscriptionId: null,
      debtPayment: null,
    },
    select: {
      amount: true,
      categoryId: true,
      category: { select: { name: true } },
      account: { select: { currency: true } },
    },
  });

  const discretionary = transactions.filter(
    (t: { categoryId: string }) => !billCategoryIds.has(t.categoryId),
  );
  if (discretionary.length === 0) return [];

  const currencies: string[] = discretionary.map((t: { account: { currency: string } }) => t.account.currency);
  const rates = await getRatesToMad(currencies);

  const totalsByCategory = new Map<string, { name: string; total: number }>();
  let grandTotal = 0;
  for (const t of discretionary as { amount: number; categoryId: string; category: { name: string }; account: { currency: string } }[]) {
    const amountMad = Math.abs(t.amount) * (rates[t.account.currency] ?? 1);
    grandTotal += amountMad;
    const entry = totalsByCategory.get(t.categoryId) ?? { name: t.category.name, total: 0 };
    entry.total += amountMad;
    totalsByCategory.set(t.categoryId, entry);
  }
  if (grandTotal <= 0) return [];

  return Array.from(totalsByCategory.entries())
    .map(([categoryId, { name, total }]) => ({
      categoryId,
      categoryName: name,
      shareMad: (total / grandTotal) * amountToSplitMad,
    }))
    .sort((a, b) => b.shareMad - a.shareMad)
    .slice(0, 5);
}
