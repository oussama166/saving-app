import { prisma } from '@/lib/prisma';
import type { HouseholdContext } from '@/lib/household';
import { getRatesToMad } from '@/lib/exchangeRates';
import { resolveBudgetCycleStart } from '@/lib/budgetCycle';

// Petit utilitaire partagé : une Transaction est toujours dans la devise de
// SON compte (Account.currency), jamais forcément MAD — voir
// lib/exchangeRates.ts. `rates` doit contenir au moins la devise de chaque
// transaction concernée (construit via getRatesToMad() sur les devises
// distinctes réellement présentes dans le lot chargé).
function toMad(amount: number, currency: string, rates: Record<string, number>): number {
  return amount * (rates[currency] ?? 1);
}

async function ratesForAccounts(transactions: { account: { currency: string } }[]): Promise<Record<string, number>> {
  const currencies = transactions.map((tx) => tx.account.currency);
  return getRatesToMad(currencies);
}

// Catégories "Besoins" (essentielles / charges fixes) — utilisé à la fois
// pour la règle 50/30/20 (app/api/dashboard/route.ts) et pour le ratio de
// charges fixes (getFinancialRatios). Reste en dur car le schéma n'a pas
// (encore) de champ `budgetGroup` sur Category.
export const NEEDS_CATEGORIES = new Set([
  'Logement & Charges',
  'Alimentation & Restauration',
  'Transport & Mobilité',
  'Santé & Médical',
  'Éducation & Développement',
]);

/**
 * Moyenne glissante des dépenses réelles sur N mois (par défaut 3).
 * Fallback à 50% du revenu de référence si pas assez d'historique.
 * Même formule que app/api/dashboard/route.ts — à terme, faire pointer
 * le dashboard vers ce helper pour éviter toute divergence de calcul.
 */
export async function getAverageMonthlyExpenses(ctx: HouseholdContext, referenceIncome: number, months = 3) {
  const now = new Date();
  const since = new Date(now.getFullYear(), now.getMonth() - months, 1);

  const transactions = await prisma.transaction.findMany({
    where: { userId: { in: ctx.memberIds }, date: { gte: since }, amount: { lt: 0 } },
    include: { account: { select: { currency: true } } },
  });

  const rates = await ratesForAccounts(transactions);
  const total = transactions.reduce((acc, tx) => acc + Math.abs(toMad(tx.amount, tx.account.currency, rates)), 0);
  return total > 0 ? total / months : referenceIncome * 0.5;
}

// Réglages (revenu de référence, devise...) : un seul jeu partagé pour tout
// le foyer, porté par le propriétaire budget — voir lib/household.ts.
export async function getUserSettings(ctx: HouseholdContext) {
  const settings = await prisma.userSettings.findUnique({ where: { userId: ctx.budgetOwnerId } });
  return {
    referenceIncome: settings?.referenceIncome ?? 10000,
    emergencyFundTargetMonths: settings?.emergencyFundTargetMonths ?? 3,
    currency: settings?.currency ?? 'MAD',
  };
}

/**
 * Total net des transactions de la catégorie "Épargne Sécurité" — sert de
 * proxy pour le solde du Fonds d'Urgence tant qu'il n'existe pas de compte
 * bancaire dédié dans le modèle Account (toutes les transactions créditent
 * aujourd'hui le même compte "Main Checking").
 *
 * Additionne les transactions encore en base + le total archivé
 * (CategoryArchive) pour cette catégorie, pour que le solde reste exact
 * même après un archivage/nettoyage (voir app/api/backup/archive/route.ts).
 */
export async function getEmergencyFundBalance(ctx: HouseholdContext) {
  const category = await prisma.category.findFirst({ where: { userId: ctx.budgetOwnerId, name: 'Épargne Sécurité' } });
  if (!category) return 0;

  const [transactions, archive] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: { in: ctx.memberIds }, categoryId: category.id },
      include: { account: { select: { currency: true } } },
    }),
    prisma.categoryArchive.findUnique({ where: { categoryId: category.id } }),
  ]);

  const rates = await ratesForAccounts(transactions);
  const liveTotal = transactions.reduce((acc, tx) => acc + toMad(tx.amount, tx.account.currency, rates), 0);
  return liveTotal + (archive?.archivedTotal ?? 0);
}

/**
 * Total net archivé + en base pour une catégorie donnée (par nom). Utilitaire
 * générique pour tout futur calcul "depuis le début" (ex: coût d'acquisition
 * cumulé des Investissements & Trading).
 */
export async function getCategoryLifetimeTotal(ctx: HouseholdContext, categoryName: string) {
  const category = await prisma.category.findFirst({ where: { userId: ctx.budgetOwnerId, name: categoryName } });
  if (!category) return 0;

  const [transactions, archive] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: { in: ctx.memberIds }, categoryId: category.id },
      include: { account: { select: { currency: true } } },
    }),
    prisma.categoryArchive.findUnique({ where: { categoryId: category.id } }),
  ]);

  const rates = await ratesForAccounts(transactions);
  const liveTotal = transactions.reduce((acc, tx) => acc + toMad(tx.amount, tx.account.currency, rates), 0);
  return liveTotal + (archive?.archivedTotal ?? 0);
}

export interface FinancialRatios {
  income: number;
  fixedCharges: number;
  savings: number;
  totalExpenses: number;
  fixedChargesRatioPct: number;
  savingsRatioPct: number;
  resteAVivre: number;
}

/**
 * Ratios financiers du mois en cours : charges fixes (catégories "Besoins"),
 * épargne/investissement (catégories de type "savings") et reste à vivre
 * (revenu - charges fixes - épargne). Si aucun revenu n'a encore été
 * enregistré ce mois-ci, on retombe sur le revenu de référence (Profil).
 */
export async function getFinancialRatios(ctx: HouseholdContext, referenceIncome: number): Promise<FinancialRatios> {
  const now = new Date();
  const start = await resolveBudgetCycleStart(ctx, now);

  const transactions = await prisma.transaction.findMany({
    where: { userId: { in: ctx.memberIds }, date: { gte: start } },
    include: { category: true, account: { select: { currency: true } } },
  });

  const rates = await ratesForAccounts(transactions);
  let income = 0;
  let fixedCharges = 0;
  let savings = 0;
  let totalExpenses = 0;

  for (const tx of transactions) {
    const amount = toMad(tx.amount, tx.account.currency, rates);
    if (tx.category.type === 'income') {
      income += amount;
    } else if (tx.category.type === 'savings') {
      savings += Math.abs(amount);
    } else {
      const abs = Math.abs(amount);
      totalExpenses += abs;
      if (NEEDS_CATEGORIES.has(tx.category.name)) fixedCharges += abs;
    }
  }

  const effectiveIncome = income > 0 ? income : referenceIncome;

  return {
    income: Math.round(effectiveIncome),
    fixedCharges: Math.round(fixedCharges),
    savings: Math.round(savings),
    totalExpenses: Math.round(totalExpenses),
    fixedChargesRatioPct: effectiveIncome > 0 ? Math.round((fixedCharges / effectiveIncome) * 1000) / 10 : 0,
    savingsRatioPct: effectiveIncome > 0 ? Math.round((savings / effectiveIncome) * 1000) / 10 : 0,
    resteAVivre: Math.round(effectiveIncome - fixedCharges - savings),
  };
}

export interface MonthlyAnalytics {
  month: string;
  label: string;
  income: number;
  expenses: number;
  savings: number;
  savingsRatePct: number;
  topCategory: { name: string; amount: number } | null;
  variationPct: number | null;
}

/**
 * Agrège les Transaction par mois sur les `monthsCount` derniers mois
 * (revenu, dépensé, épargne/invest, % épargné, top catégorie de dépense,
 * variation des dépenses vs mois précédent). Calculé à la volée — pas de
 * modèle de snapshot dédié pour l'instant.
 */
export async function getMonthlyAnalytics(ctx: HouseholdContext, monthsCount = 6): Promise<MonthlyAnalytics[]> {
  const now = new Date();
  const months = Array.from({ length: monthsCount }, (_, i) => {
    const offset = monthsCount - 1 - i;
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
    const label = start.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
    return { key, label, start, end };
  });

  const transactions = await prisma.transaction.findMany({
    where: { userId: { in: ctx.memberIds }, date: { gte: months[0].start } },
    include: { category: true, account: { select: { currency: true } } },
  });

  const rates = await ratesForAccounts(transactions);
  const buckets = new Map(
    months.map((m) => [
      m.key,
      { income: 0, expenses: 0, savings: 0, categoryTotals: new Map<string, number>() },
    ]),
  );

  for (const tx of transactions) {
    const bucketMonth = months.find((m) => tx.date >= m.start && tx.date < m.end);
    if (!bucketMonth) continue;
    const bucket = buckets.get(bucketMonth.key)!;
    const amount = toMad(tx.amount, tx.account.currency, rates);

    if (tx.category.type === 'income') {
      bucket.income += amount;
    } else if (tx.category.type === 'savings') {
      bucket.savings += Math.abs(amount);
    } else {
      const abs = Math.abs(amount);
      bucket.expenses += abs;
      bucket.categoryTotals.set(tx.category.name, (bucket.categoryTotals.get(tx.category.name) ?? 0) + abs);
    }
  }

  return months.map((m, idx) => {
    const bucket = buckets.get(m.key)!;
    const savingsRatePct = bucket.income > 0 ? (bucket.savings / bucket.income) * 100 : 0;

    let topCategory: { name: string; amount: number } | null = null;
    for (const [name, amount] of bucket.categoryTotals) {
      if (!topCategory || amount > topCategory.amount) topCategory = { name, amount };
    }

    const prevBucket = idx > 0 ? buckets.get(months[idx - 1].key) : null;
    const variationPct =
      prevBucket && prevBucket.expenses > 0
        ? ((bucket.expenses - prevBucket.expenses) / prevBucket.expenses) * 100
        : null;

    return {
      month: m.key,
      label: m.label,
      income: Math.round(bucket.income),
      expenses: Math.round(bucket.expenses),
      savings: Math.round(bucket.savings),
      savingsRatePct: Math.round(savingsRatePct * 10) / 10,
      topCategory: topCategory ? { name: topCategory.name, amount: Math.round(topCategory.amount) } : null,
      variationPct: variationPct !== null ? Math.round(variationPct * 10) / 10 : null,
    };
  });
}

export interface CategoryTrend {
  name: string;
  total: number;
  // Dépense par mois sur la période, dans l'ordre chronologique (même
  // fenêtre que getMonthlyAnalytics), pour tracer la tendance catégorie par
  // catégorie plutôt qu'un seul "top catégorie" par mois.
  monthly: { month: string; label: string; amount: number }[];
  trendPct: number | null; // évolution dernier mois vs premier mois de la fenêtre
}

/**
 * Classement des `topN` catégories de dépense (type "expense") les plus
 * lourdes sur les `monthsCount` derniers mois, avec leur répartition
 * mois par mois — sert à repérer les catégories qui dérapent dans la durée
 * plutôt que sur un seul mois isolé.
 */
export async function getTopCategoriesTrend(ctx: HouseholdContext, monthsCount = 6, topN = 5): Promise<CategoryTrend[]> {
  const now = new Date();
  const months = Array.from({ length: monthsCount }, (_, i) => {
    const offset = monthsCount - 1 - i;
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
    const label = start.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
    return { key, label, start, end };
  });

  const transactions = await prisma.transaction.findMany({
    where: { userId: { in: ctx.memberIds }, date: { gte: months[0].start }, category: { type: 'expense' } },
    include: { category: true, account: { select: { currency: true } } },
  });

  const rates = await ratesForAccounts(transactions);
  const totals = new Map<string, number>();
  const perMonth = new Map<string, Map<string, number>>(); // nom catégorie -> mois -> montant

  for (const tx of transactions) {
    const bucketMonth = months.find((m) => tx.date >= m.start && tx.date < m.end);
    if (!bucketMonth) continue;

    const abs = Math.abs(toMad(tx.amount, tx.account.currency, rates));
    const name = tx.category.name;
    totals.set(name, (totals.get(name) ?? 0) + abs);

    if (!perMonth.has(name)) perMonth.set(name, new Map());
    const catMonths = perMonth.get(name)!;
    catMonths.set(bucketMonth.key, (catMonths.get(bucketMonth.key) ?? 0) + abs);
  }

  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN);

  return ranked.map(([name, total]) => {
    const catMonths = perMonth.get(name);
    const monthly = months.map((m) => ({
      month: m.key,
      label: m.label,
      amount: Math.round(catMonths?.get(m.key) ?? 0),
    }));

    const first = monthly[0].amount;
    const last = monthly[monthly.length - 1].amount;
    const trendPct = first > 0 ? Math.round(((last - first) / first) * 1000) / 10 : last > 0 ? null : 0;

    return { name, total: Math.round(total), monthly, trendPct };
  });
}

export interface HealthBudget {
  budgetPct: number; // % du revenu de référence alloué à "Santé & Médical"
  plannedMonthly: number; // prévu ce mois-ci (budgetPct * revenu de référence)
  spentThisMonth: number; // dépensé ce mois-ci sur la catégorie
  remaining: number; // prévu - dépensé (peut être négatif si dépassé)
  estimatedAnnual: number; // prévu mensuel x 12
  weightOnIncomePct: number; // dépensé réel / revenu de référence, en %
}

/**
 * Budget santé mensuel basé sur Category("Santé & Médical").budgetPct * le
 * revenu de référence (page Profil), comparé aux dépenses réelles du mois
 * en cours sur cette catégorie.
 */
export async function getHealthBudget(ctx: HouseholdContext, referenceIncome: number): Promise<HealthBudget> {
  const category = await prisma.category.findFirst({ where: { userId: ctx.budgetOwnerId, name: 'Santé & Médical' } });
  const budgetPct = category?.budgetPct ?? 0;
  const plannedMonthly = (budgetPct / 100) * referenceIncome;

  const now = new Date();
  const start = await resolveBudgetCycleStart(ctx, now);

  let spentAbs = 0;
  if (category) {
    // findMany + reduce plutôt que prisma.aggregate() : la conversion en MAD
    // (compte en devise étrangère) doit se faire par transaction avant de
    // sommer, un aggregate() SQL ne peut pas appliquer un taux de change.
    const txs = await prisma.transaction.findMany({
      where: { userId: { in: ctx.memberIds }, categoryId: category.id, date: { gte: start } },
      include: { account: { select: { currency: true } } },
    });
    const rates = await ratesForAccounts(txs);
    spentAbs = Math.abs(txs.reduce((acc, tx) => acc + toMad(tx.amount, tx.account.currency, rates), 0));
  }

  const remaining = plannedMonthly - spentAbs;
  const estimatedAnnual = plannedMonthly * 12;
  const weightOnIncomePct = referenceIncome > 0 ? (spentAbs / referenceIncome) * 100 : 0;

  return {
    budgetPct,
    plannedMonthly: Math.round(plannedMonthly),
    spentThisMonth: Math.round(spentAbs),
    remaining: Math.round(remaining),
    estimatedAnnual: Math.round(estimatedAnnual),
    weightOnIncomePct: Math.round(weightOnIncomePct * 10) / 10,
  };
}

export interface HealthSpendingPoint {
  month: string;
  label: string;
  amount: number;
}

/**
 * Dépenses réelles de la catégorie "Santé & Médical" mois par mois sur les
 * `monthsCount` derniers mois — sert à tracer la tendance sur la page Santé
 * (au lieu d'un seul chiffre du mois en cours comme dans getHealthBudget).
 */
export async function getHealthSpendingTrend(ctx: HouseholdContext, monthsCount = 6): Promise<HealthSpendingPoint[]> {
  const now = new Date();
  const months = Array.from({ length: monthsCount }, (_, i) => {
    const offset = monthsCount - 1 - i;
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
    const label = start.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
    return { key, label, start, end };
  });

  const category = await prisma.category.findFirst({ where: { userId: ctx.budgetOwnerId, name: 'Santé & Médical' } });
  if (!category) return months.map((m) => ({ month: m.key, label: m.label, amount: 0 }));

  const transactions = await prisma.transaction.findMany({
    where: { userId: { in: ctx.memberIds }, categoryId: category.id, date: { gte: months[0].start } },
    include: { account: { select: { currency: true } } },
  });
  const rates = await ratesForAccounts(transactions);

  return months.map((m) => {
    const amount = transactions
      .filter((tx) => tx.date >= m.start && tx.date < m.end)
      .reduce((acc, tx) => acc + Math.abs(toMad(tx.amount, tx.account.currency, rates)), 0);
    return { month: m.key, label: m.label, amount: Math.round(amount) };
  });
}

export interface RealBudgetCategory {
  categoryId: string;
  categoryName: string;
  ciblePct: number; // Category.budgetPct actuel (page Profil)
  spent: number;
  realPct: number; // part de `spent` dans le total analysé sur la période
  isOverBudget: boolean; // realPct dépasse ciblePct d'une marge notable
}

export interface RealBudgetSummary {
  totalAnalyzed: number;
  transactionCount: number;
  categories: RealBudgetCategory[];
}

// Marge au-delà de laquelle un écart cible/réel est signalé comme dépassement.
const OVER_BUDGET_MARGIN_PCT = 3;

/**
 * Répartition RÉELLE des dépenses (catégories "expense"/"savings", le même
 * périmètre que les allocations budgétaires) sur la période demandée, en %
 * du total dépensé — à comparer à Category.budgetPct ("cible"). Sert à
 * "Optimisateur de Budget Réel" (page Profil) : proposer de recopier cette
 * répartition réelle dans les allocations plutôt que de garder des % figés.
 *
 * Note : pour `period: 'all'`, ne compte que les transactions encore en base
 * (pas les montants déjà archivés via app/api/backup/archive/route.ts) — à
 * améliorer si l'historique global doit rester exact après un nettoyage.
 */
export async function getRealBudgetSummary(
  ctx: HouseholdContext,
  period: 'month' | 'all' = 'month',
): Promise<RealBudgetSummary> {
  const categories = await prisma.category.findMany({
    where: { userId: ctx.budgetOwnerId, type: { in: ['expense', 'savings'] } },
    orderBy: { order: 'asc' },
  });

  const now = new Date();
  const start = period === 'month' ? await resolveBudgetCycleStart(ctx, now) : undefined;

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: { in: ctx.memberIds },
      categoryId: { in: categories.map((c) => c.id) },
      ...(start ? { date: { gte: start } } : {}),
    },
    include: { account: { select: { currency: true } } },
  });

  const rates = await ratesForAccounts(transactions);
  const spentByCategory = new Map<string, number>();
  for (const tx of transactions) {
    spentByCategory.set(
      tx.categoryId,
      (spentByCategory.get(tx.categoryId) ?? 0) + Math.abs(toMad(tx.amount, tx.account.currency, rates)),
    );
  }

  const totalAnalyzed = [...spentByCategory.values()].reduce((acc, v) => acc + v, 0);

  const categoryRows: RealBudgetCategory[] = categories.map((cat) => {
    const spent = spentByCategory.get(cat.id) ?? 0;
    const realPct = totalAnalyzed > 0 ? (spent / totalAnalyzed) * 100 : 0;

    return {
      categoryId: cat.id,
      categoryName: cat.name,
      ciblePct: cat.budgetPct,
      spent: Math.round(spent),
      realPct: Math.round(realPct * 10) / 10,
      isOverBudget: realPct - cat.budgetPct > OVER_BUDGET_MARGIN_PCT,
    };
  });

  return {
    totalAnalyzed: Math.round(totalAnalyzed),
    transactionCount: transactions.length,
    categories: categoryRows,
  };
}
