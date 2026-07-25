import { prisma } from "@/lib/prisma";
import { sendWeeklyDigestEmail } from "@/lib/email";

export interface WeeklyDigestData {
  weekIncome: number;
  weekExpenses: number;
  topCategories: { name: string; amount: number }[];
  budgetWarnings: { name: string; usedPct: number; spent: number; budget: number }[];
  goalsCount: number;
  goalsProgressPct: number;
  weekGoalContributions: number;
}

/**
 * Calcule le résumé des 7 derniers jours pour un utilisateur : cash-flow,
 * top catégories de dépense, catégories déjà proches/au-dessus de leur
 * budget mensuel (même calcul que /api/dashboard, mais indépendant de la
 * session — appelé par un job planifié, pas par le navigateur), et
 * l'avancement des objectifs d'épargne actifs.
 */
export async function buildWeeklyDigest(userId: string): Promise<WeeklyDigestData | null> {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [weekTransactions, monthExpenseTransactions, categories, userSettings, goals] =
    await Promise.all([
      prisma.transaction.findMany({
        where: { userId, date: { gte: weekAgo } },
        include: { category: true },
      }),
      prisma.transaction.findMany({
        where: { userId, date: { gte: firstDayOfMonth }, amount: { lt: 0 } },
        include: { category: true },
      }),
      prisma.category.findMany({ where: { userId, type: "expense" } }),
      prisma.userSettings.findUnique({ where: { userId } }),
      prisma.savingsGoal.findMany({ where: { userId } }),
    ]);

  if (weekTransactions.length === 0 && monthExpenseTransactions.length === 0 && goals.length === 0) {
    return null; // compte inactif — pas la peine d'envoyer un digest vide
  }

  let weekIncome = 0;
  let weekExpenses = 0;
  const weekByCategory: Record<string, number> = {};
  for (const tx of weekTransactions) {
    if (tx.amount > 0) {
      weekIncome += tx.amount;
    } else {
      const abs = Math.abs(tx.amount);
      weekExpenses += abs;
      weekByCategory[tx.category.name] = (weekByCategory[tx.category.name] ?? 0) + abs;
    }
  }
  const topCategories = Object.entries(weekByCategory)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const referenceIncome = userSettings?.referenceIncome ?? 10000;
  const monthByCategory: Record<string, number> = {};
  for (const tx of monthExpenseTransactions) {
    monthByCategory[tx.category.name] = (monthByCategory[tx.category.name] ?? 0) + Math.abs(tx.amount);
  }
  const budgetWarnings = categories
    .filter((cat) => cat.budgetPct > 0)
    .map((cat) => {
      const budget = (cat.budgetPct / 100) * referenceIncome;
      const spent = monthByCategory[cat.name] ?? 0;
      const usedPct = budget > 0 ? (spent / budget) * 100 : 0;
      return { name: cat.name, usedPct: Math.round(usedPct), spent, budget };
    })
    .filter((c) => c.usedPct >= 80)
    .sort((a, b) => b.usedPct - a.usedPct);

  const goalsCount = goals.length;
  const totalTarget = goals.reduce((acc, g) => acc + g.targetAmount, 0);
  const totalSaved = goals.reduce((acc, g) => acc + g.currentAmount, 0);
  const goalsProgressPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;
  const weekGoalContributions = await prisma.goalContribution.aggregate({
    where: { userId, date: { gte: weekAgo } },
    _sum: { amount: true },
  });

  return {
    weekIncome,
    weekExpenses,
    topCategories,
    budgetWarnings,
    goalsCount,
    goalsProgressPct,
    weekGoalContributions: weekGoalContributions._sum.amount ?? 0,
  };
}

/**
 * Génère et envoie le digest hebdomadaire pour un utilisateur. Retourne
 * `false` sans lever si rien à envoyer (compte inactif) ou si l'email
 * échoue — appelé en boucle sur tous les utilisateurs par
 * /api/cron/weekly-digest, une erreur sur un compte ne doit jamais faire
 * échouer les autres.
 */
export async function sendWeeklyDigestForUser(userId: string, email: string): Promise<boolean> {
  try {
    const data = await buildWeeklyDigest(userId);
    if (!data) return false;
    return await sendWeeklyDigestEmail(email, data);
  } catch (error) {
    console.error(`sendWeeklyDigestForUser a échoué pour userId=${userId}:`, error);
    return false;
  }
}
