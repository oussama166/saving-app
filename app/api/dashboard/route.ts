import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEnrichedPortfolioAssets } from "@/lib/portfolio";
import { NEEDS_CATEGORIES } from "@/lib/financials";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await requireSession();

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    const [
      checkingAccounts,
      savingsGoals,
      allTransactions,
      categories,
      userSettings,
      last3MonthsExpenses,
      portfolio,
    ] = await Promise.all([
      prisma.account.findMany({ where: { userId, type: "checking" } }),
      prisma.savingsGoal.findMany({ where: { userId } }),
      prisma.transaction.findMany({
        where: { userId, date: { gte: firstDayOfMonth } },
        include: { category: true },
      }),
      prisma.category.findMany({ where: { userId } }),
      prisma.userSettings.findUnique({ where: { userId } }),
      prisma.transaction.findMany({
        where: { userId, date: { gte: threeMonthsAgo }, amount: { lt: 0 } },
      }),
      getEnrichedPortfolioAssets(userId),
    ]);

    // Revenu de référence (page Profil) — fallback si UserSettings n'existe pas encore
    const referenceIncome = userSettings?.referenceIncome ?? 10000;

    // Basic Metrics
    const totalCheckingBalance = checkingAccounts.reduce(
      (acc, curr) => acc + curr.balance,
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
      if (tx.amount > 0) {
        income += tx.amount;
      } else {
        const absAmount = Math.abs(tx.amount);
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
      (acc, tx) => acc + Math.abs(tx.amount),
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

    const totalBudget =
      income || ruleTotals.Needs + ruleTotals.Wants + ruleTotals.Savings || 1;
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
      where: { userId },
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
    console.error("Dashboard Aggregator Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
