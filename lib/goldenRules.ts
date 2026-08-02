import { prisma } from '@/lib/prisma';
import type { HouseholdContext } from '@/lib/household';
import { getRatesToMad } from '@/lib/exchangeRates';
import { getEnrichedPortfolioAssets } from '@/lib/portfolio';
import { resolveBudgetCycleStart } from '@/lib/budgetCycle';

// Évaluation déterministe des "Règles d'Or" (voir app/components/
// CoachGoldenRulesTab.tsx) — les 6 règles historiques étaient de simples
// seuils affichés (revenu de référence * %), jamais comparés aux dépenses
// réelles. Ce module calcule, pour chaque règle qui PEUT l'être de façon
// fiable à partir des données déjà en base, un statut réel — les règles
// ponctuelles (achat voiture/smartphone, pas de récurrence à observer)
// restent purement informatives (status 'info', exclues du score).
//
// Aucun appel IA ici : uniquement de l'arithmétique sur des données
// déterministes, comme partout ailleurs dans le Coach IA (lib/coachHandler.ts
// ne fait que commenter des nombres déjà calculés côté serveur).

export type GoldenRuleStatus = 'respected' | 'exceeded' | 'info';

export interface GoldenRuleResult {
  id: string;
  status: GoldenRuleStatus;
  detail: string;
}

export interface GoldenRulesEvaluation {
  results: GoldenRuleResult[];
  scorePct: number; // 0-100, sur les règles "scored" (status !== 'info') applicables
  scoredCount: number;
  respectedCount: number;
}

const RENT_CATEGORY_RE = /logement|loyer/i;
const DINING_CATEGORY_RE = /restaurant|sortie/i;

function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const fmtMAD = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} DH`;

/**
 * Calcule le statut des règles à partir des données du foyer — requêtes
 * volontairement indépendantes de /api/dashboard (pas de dépendance sur ce
 * que le client a déjà en cache) : cette évaluation doit rester fiable même
 * appelée seule, et certaines règles (dettes hors immo, diversification
 * portefeuille) ont besoin de données que le dashboard n'expose pas.
 */
export async function evaluateGoldenRules(ctx: HouseholdContext): Promise<GoldenRulesEvaluation> {
  const now = new Date();
  const userSettings = await prisma.userSettings.findUnique({ where: { userId: ctx.budgetOwnerId } });
  const referenceIncome = userSettings?.referenceIncome ?? 10000;

  const cycleStart = await resolveBudgetCycleStart(ctx, now, userSettings);
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

  const [checkingAccounts, cycleTransactions, last3MonthsExpenses, activeDebts, portfolio] = await Promise.all([
    prisma.account.findMany({ where: { userId: { in: ctx.memberIds }, type: 'checking' } }),
    prisma.transaction.findMany({
      where: { userId: { in: ctx.memberIds }, date: { gte: cycleStart } },
      include: { category: true, account: { select: { currency: true } } },
    }),
    prisma.transaction.findMany({
      where: { userId: { in: ctx.memberIds }, date: { gte: threeMonthsAgo }, amount: { lt: 0 } },
      include: { account: { select: { currency: true } } },
    }),
    prisma.debt.findMany({ where: { userId: { in: ctx.memberIds }, isActive: true } }),
    getEnrichedPortfolioAssets(ctx),
  ]);

  const rates = await getRatesToMad([
    ...checkingAccounts.map((a) => a.currency),
    ...cycleTransactions.map((t) => t.account.currency),
    ...last3MonthsExpenses.map((t) => t.account.currency),
  ]);

  // Fonds d'urgence / ratio de liquidité — même formule que
  // metrics.emergencyFundMonths de /api/dashboard (solde des comptes
  // courants / moyenne des dépenses des 3 derniers mois) : c'est déjà,
  // littéralement, un ratio de liquidité (mois de charges couverts par du
  // cash disponible), donc une seule règle plutôt que deux quasi-identiques.
  const totalCheckingBalance = checkingAccounts.reduce((acc, a) => acc + a.balance * (rates[a.currency] ?? 1), 0);
  const totalExpenses3Months = last3MonthsExpenses.reduce(
    (acc, t) => acc + Math.abs(t.amount * (rates[t.account.currency] ?? 1)),
    0,
  );
  const avgMonthlyExpenses = totalExpenses3Months > 0 ? totalExpenses3Months / 3 : referenceIncome * 0.5;
  const emergencyFundMonths = avgMonthlyExpenses > 0 ? totalCheckingBalance / avgMonthlyExpenses : 0;

  let rentSpent = 0;
  let diningSpent = 0;
  let savingsAmount = 0;
  for (const tx of cycleTransactions) {
    const amount = tx.amount * (rates[tx.account.currency] ?? 1);
    if (tx.category.type === 'savings') {
      savingsAmount += Math.abs(amount);
      continue;
    }
    if (tx.category.type !== 'expense' || amount >= 0) continue;
    const abs = Math.abs(amount);
    if (RENT_CATEGORY_RE.test(tx.category.name)) rentSpent += abs;
    else if (DINING_CATEGORY_RE.test(tx.category.name)) diningSpent += abs;
  }

  // Mensualités de crédit hors immobilier (le prêt immo a sa propre règle
  // implicite via le loyer/logement, et 33% d'endettement max porte
  // traditionnellement sur le crédit conso, pas la résidence principale).
  const debtMonthly = activeDebts.filter((d) => d.type !== 'pret_immo').reduce((acc, d) => acc + d.monthlyPayment, 0);

  const assetTypeTotals = new Map<string, number>();
  for (const asset of portfolio.enrichedAssets) {
    const valueInMad = asset.liveValue * (rates[asset.currency] ?? 1);
    assetTypeTotals.set(asset.assetType, (assetTypeTotals.get(asset.assetType) ?? 0) + valueInMad);
  }
  const maxAssetShare =
    portfolio.globalLiveValue > 0 ? Math.max(...Array.from(assetTypeTotals.values())) / portfolio.globalLiveValue : 0;

  const retirementPct = referenceIncome > 0 ? Math.round((savingsAmount / referenceIncome) * 100) : 0;

  const results: GoldenRuleResult[] = [
    {
      id: 'rent',
      status: rentSpent > referenceIncome * 0.3 ? 'exceeded' : 'respected',
      detail:
        rentSpent > 0
          ? `${fmtMAD(rentSpent)} dépensé ce mois-ci en logement (seuil ${fmtMAD(referenceIncome * 0.3)})`
          : `Aucune dépense "Logement/Loyer" détectée ce mois-ci (seuil ${fmtMAD(referenceIncome * 0.3)})`,
    },
    {
      id: 'car',
      status: 'info',
      detail: "À vérifier toi-même au moment de l'achat ou de la souscription du crédit — pas de suivi automatique.",
    },
    {
      id: 'smartphone',
      status: 'info',
      detail: "À vérifier toi-même au moment de l'achat — pas de suivi automatique.",
    },
    {
      id: 'dining',
      status: diningSpent > referenceIncome * 0.1 ? 'exceeded' : 'respected',
      detail: `${fmtMAD(diningSpent)} dépensé ce mois-ci en restaurants/sorties (seuil ${fmtMAD(referenceIncome * 0.1)})`,
    },
    {
      id: 'debt',
      status: debtMonthly > referenceIncome * 0.33 ? 'exceeded' : 'respected',
      detail: `${fmtMAD(debtMonthly)}/mois de mensualités de crédit hors immobilier (seuil ${fmtMAD(referenceIncome * 0.33)})`,
    },
    {
      id: 'emergencyFund',
      status: emergencyFundMonths >= 3 ? 'respected' : 'exceeded',
      detail: `${emergencyFundMonths.toFixed(1)} mois de charges couverts par ton cash disponible (minimum recommandé : 3)`,
    },
    {
      id: 'retirement',
      status: savingsAmount >= referenceIncome * 0.1 ? 'respected' : 'exceeded',
      detail: `${fmtMAD(savingsAmount)} épargné ce mois-ci, soit ${retirementPct}% du revenu de référence (cible : 10-15%)`,
    },
    portfolio.globalLiveValue > 0
      ? {
          id: 'diversification',
          status: maxAssetShare <= 0.5 ? 'respected' : 'exceeded',
          detail: `${Math.round(maxAssetShare * 100)}% de ton portefeuille concentré sur une seule classe d'actifs (seuil recommandé : 50% max)`,
        }
      : {
          id: 'diversification',
          status: 'info' as const,
          detail: "Pas encore de placements enregistrés (page Portefeuille) — rien à évaluer.",
        },
  ];

  const scoredResults = results.filter((r) => r.status !== 'info');
  const respectedCount = scoredResults.filter((r) => r.status === 'respected').length;
  const scorePct = scoredResults.length > 0 ? Math.round((respectedCount / scoredResults.length) * 100) : 0;

  return { results, scorePct, scoredCount: scoredResults.length, respectedCount };
}

/**
 * Enregistre/actualise la photo du jour (idempotent, upsert sur userId+date)
 * — même principe que captureDailyBudgetSnapshot (lib/budgetDiscipline.ts).
 * Appelée à chaque chargement de l'onglet Règles d'Or, donc plusieurs fois
 * par jour tant que la journée n'est pas terminée.
 */
export async function captureGoldenRuleSnapshot(
  ctx: HouseholdContext,
  evaluation: GoldenRulesEvaluation,
): Promise<void> {
  const today = atMidnight(new Date());
  const rulesJson = JSON.stringify(Object.fromEntries(evaluation.results.map((r) => [r.id, r.status])));
  await prisma.goldenRuleSnapshot.upsert({
    where: { userId_date: { userId: ctx.budgetOwnerId, date: today } },
    update: { scorePct: evaluation.scorePct, rulesJson },
    create: { userId: ctx.budgetOwnerId, date: today, scorePct: evaluation.scorePct, rulesJson },
  });
}

export interface GoldenRuleHistoryPoint {
  date: string;
  scorePct: number;
}

export interface GoldenRuleHistory {
  points: GoldenRuleHistoryPoint[];
  // Règles qui viennent de passer de "respected" à "exceeded" entre
  // l'avant-dernier snapshot enregistré et celui du jour — affichées en
  // bannière d'alerte (voir CoachGoldenRulesTab.tsx). null si pas assez
  // d'historique pour comparer (première visite, ou un seul snapshot).
  newlyExceededRuleIds: string[] | null;
}

/**
 * Historique du score (jusqu'à `limit` derniers snapshots, jour courant
 * inclus) + détection des règles nouvellement franchies par rapport au
 * snapshot précédent — pour l'évolution dans le temps et la bannière
 * d'alerte de l'onglet Règles d'Or.
 */
export async function getGoldenRuleHistory(ctx: HouseholdContext, limit = 30): Promise<GoldenRuleHistory> {
  const snapshots = await prisma.goldenRuleSnapshot.findMany({
    where: { userId: ctx.budgetOwnerId },
    orderBy: { date: 'desc' },
    take: limit,
  });

  const points: GoldenRuleHistoryPoint[] = snapshots
    .slice()
    .reverse()
    .map((s: { date: Date; scorePct: number }) => ({ date: s.date.toISOString(), scorePct: s.scorePct }));

  let newlyExceededRuleIds: string[] | null = null;
  if (snapshots.length >= 2) {
    const latest = JSON.parse(snapshots[0].rulesJson) as Record<string, GoldenRuleStatus>;
    const previous = JSON.parse(snapshots[1].rulesJson) as Record<string, GoldenRuleStatus>;
    newlyExceededRuleIds = Object.keys(latest).filter(
      (ruleId) => latest[ruleId] === 'exceeded' && previous[ruleId] === 'respected',
    );
  }

  return { points, newlyExceededRuleIds };
}
