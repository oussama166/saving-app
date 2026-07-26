import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEnrichedPortfolioAssets } from "@/lib/portfolio";
import { NEEDS_CATEGORIES } from "@/lib/financials";
import { requireSession } from "@/lib/auth";
import { getHouseholdContext } from "@/lib/household";
import { getRatesToMad } from "@/lib/exchangeRates";
import { requireFeatureAccess } from "@/lib/features";
import { resolveBudgetCycleStart } from "@/lib/budgetCycle";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await requireSession();
    await requireFeatureAccess("dashboard", userId);
    const ctx = await getHouseholdContext(userId);

    const now = new Date();
    // userSettings récupéré à part (avant le Promise.all) car
    // resolveBudgetCycleStart() en a besoin pour situer le début du cycle
    // budgétaire en cours — évite une deuxième requête identique en le
    // passant en `preloadedSettings`.
    const userSettings = await prisma.userSettings.findUnique({ where: { userId: ctx.budgetOwnerId } });
    const cycleStart = await resolveBudgetCycleStart(ctx, now, userSettings);
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    const [
      checkingAccounts,
      savingsGoals,
      allTransactions,
      categories,
      last3MonthsExpenses,
      portfolio,
    ] = await Promise.all([
      prisma.account.findMany({ where: { userId: { in: ctx.memberIds }, type: "checking" } }),
      prisma.savingsGoal.findMany({ where: { userId: { in: ctx.memberIds } } }),
      prisma.transaction.findMany({
        where: { userId: { in: ctx.memberIds }, date: { gte: cycleStart } },
        include: { category: true, account: { select: { currency: true } } },
      }),
      prisma.category.findMany({ where: { userId: ctx.budgetOwnerId } }),
      prisma.transaction.findMany({
        where: { userId: { in: ctx.memberIds }, date: { gte: threeMonthsAgo }, amount: { lt: 0 } },
        include: { account: { select: { currency: true } } },
      }),
      getEnrichedPortfolioAssets(ctx),
    ]);

    // Dettes actives — pour le patrimoine net (actifs - dettes), voir carte
    // Dettes du dashboard et /debts pour le détail.
    const activeDebts = await prisma.debt.findMany({ where: { userId: { in: ctx.memberIds }, isActive: true } });
    const totalDebts = activeDebts.reduce((acc, d) => acc + d.currentBalance, 0);

    // Revenu de référence (page Profil) — fallback si UserSettings n'existe pas encore
    const referenceIncome = userSettings?.referenceIncome ?? 10000;

    // Taux de conversion vers MAD pour les comptes en devise étrangère (voir
    // lib/exchangeRates.ts) — MAD lui-même ne coûte ni requête ni appel réseau.
    // Rassemble les devises distinctes de TOUTES les sources ci-dessus (pas
    // seulement les comptes courants) : une transaction peut provenir d'un
    // compte non-courant (ex: épargne en devise étrangère).
    const fxRates = await getRatesToMad([
      ...checkingAccounts.map((a) => a.currency),
      ...allTransactions.map((tx) => tx.account.currency),
      ...last3MonthsExpenses.map((tx) => tx.account.currency),
    ]);

    // Basic Metrics
    const totalCheckingBalance = checkingAccounts.reduce(
      (acc, curr) => acc + curr.balance * (fxRates[curr.currency] ?? 1),
      0,
    );
    const totalSavingsLocked = savingsGoals.reduce(
      (acc, curr) => acc + curr.currentAmount,
      0,
    );
    const safeToSpend = totalCheckingBalance - totalSavingsLocked;

    // Monthly Cash Flow
    let income = 0;
    let expenses = 0;
    const expensesByCategoryMap: Record<string, number> = {};

    allTransactions.forEach((tx) => {
      const amount = tx.amount * (fxRates[tx.account.currency] ?? 1);
      if (amount > 0) {
        income += amount;
      } else {
        const absAmount = Math.abs(amount);
        expenses += absAmount;
        expensesByCategoryMap[tx.category.name] =
          (expensesByCategoryMap[tx.category.name] || 0) + absAmount;
      }
    });

    const cashFlow = income - expenses;

    // Emergency Fund Months — moyenne glissante des dépenses réelles sur les
    // 3 derniers mois. Si pas assez d'historique, on retombe sur 50% du
    // revenu de référence comme estimation.
    const totalExpenses3Months = last3MonthsExpenses.reduce(
      (acc, tx) => acc + Math.abs(tx.amount * (fxRates[tx.account.currency] ?? 1)),
      0,
    );
    const avgMonthlyExpenses =
      totalExpenses3Months > 0
        ? totalExpenses3Months / 3
        : referenceIncome * 0.5;
    const emergencyFundMonths =
      avgMonthlyExpenses > 0 ? totalCheckingBalance / avgMonthlyExpenses : 0;

    // Health Score (Savings Rate)
    const savingsRate = income > 0 ? (cashFlow / income) * 100 : 0;
    const healthScore = Math.min(Math.max(Math.round(savingsRate * 2), 0), 100);

    // Budget Details & Chart Data — basé sur Category.budgetPct * revenu de référence
    const budgetDetails = categories
      .filter((cat) => cat.type === "expense")
      .sort((a, b) => a.order - b.order)
      .map((cat) => {
        const spent = expensesByCategoryMap[cat.name] || 0;
        const budget = (cat.budgetPct / 100) * referenceIncome;
        const remaining = budget - spent;
        const usedPct = budget > 0 ? (spent / budget) * 100 : 0;

        return {
          categoryName: cat.name,
          allocationPct: cat.budgetPct,
          budgetedAmount: Math.round(budget * 100) / 100,
          spentAmount: spent,
          remainingAmount: Math.round(remaining * 100) / 100,
          usedPct: Math.round(usedPct),
        };
      });

    // 50/30/20 Rule
    const ruleTotals = {
      Needs: 0,
      Wants: 0,
      Savings: cashFlow > 0 ? cashFlow : 0,
    };
    Object.entries(expensesByCategoryMap).forEach(([name, amt]) => {
      if (NEEDS_CATEGORIES.has(name)) ruleTotals.Needs += amt;
      else ruleTotals.Wants += amt;
    });

    // Dénominateur du split 50/30/20 : le revenu réel du mois si connu,
    // sinon le revenu de référence (page Profil) — jamais la somme des
    // dépenses elles-mêmes. Avant ce correctif, sans transaction de revenu
    // ce mois-ci, le fallback retombait sur "Needs + Wants + Savings" (donc
    // sur le total dépensé), ce qui gonflait artificiellement les % dès que
    // peu de dépenses étaient loguées (ex: une seule dépense "Needs" en
    // début de mois affichait 100% Needs, alors que ce n'est que 0,45% d'un
    // revenu de 10 000 MAD).
    const totalBudget = income > 0 ? income : referenceIncome || 1;
    const rule503020 = {
      needs: {
        amount: ruleTotals.Needs,
        pct: Math.round((ruleTotals.Needs / totalBudget) * 100),
      },
      wants: {
        amount: ruleTotals.Wants,
        pct: Math.round((ruleTotals.Wants / totalBudget) * 100),
      },
      savings: {
        amount: ruleTotals.Savings,
        pct: Math.round((ruleTotals.Savings / totalBudget) * 100),
      },
    };

    // Chart Data
    const chartData = {
      expensesByCategory: Object.entries(expensesByCategoryMap).map(
        ([name, value]) => ({ name, value }),
      ),
      budgetVsActual: budgetDetails.map((b) => ({
        category: b.categoryName,
        budget: b.budgetedAmount,
        actual: b.spentAmount,
      })),
    };

    const recentTransactions = await prisma.transaction.findMany({
      where: { userId: { in: ctx.memberIds } },
      take: 10,
      orderBy: { date: "desc" },
      include: {
        account: { select: { name: true } },
        category: { select: { name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        metrics: {
          cashFlow,
          emergencyFundMonths: Number(emergencyFundMonths.toFixed(1)),
          portfolioValue: Math.round(portfolio.globalLiveValue * 100) / 100,
          healthScore,
        },
        netWorth: {
          totalDebts: Math.round(totalDebts * 100) / 100,
          // Actifs = liquidités (comptes courants) + placements (portfolio) + épargne verrouillée (objectifs) — moins les dettes actives.
          netWorth:
            Math.round(
              (totalCheckingBalance + portfolio.globalLiveValue + totalSavingsLocked - totalDebts) * 100,
            ) / 100,
        },
        budgetDetails,
        rule503020,
        chartData,
        totalCheckingBalance,
        totalSavingsLocked,
        safeToSpend,
        recentTransactions,
        // Exposés pour la page Coach IA (Règles d'Or, Diagnostic) — évite un
        // second aller-retour réseau pour UserSettings.referenceIncome.
        referenceIncome,
        avgMonthlyExpenses: Math.round(avgMonthlyExpenses * 100) / 100,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json(
        { success: false, error: "Non authentifié" },
        { status: 401 },
      );
    }
    if (error instanceof Error && error.message === "FEATURE_DISABLED") {
      return NextResponse.json(
        { success: false, error: "Cette fonctionnalité est temporairement désactivée." },
        { status: 403 },
      );
    }
    console.error("Dashboard Aggregator Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
