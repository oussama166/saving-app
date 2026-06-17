import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      checkingAccounts,
      savingsGoals,
      portfolioAssets,
      allTransactions,
      categories
    ] = await Promise.all([
      prisma.account.findMany({ where: { type: 'checking' } }),
      prisma.savingsGoal.findMany(),
      prisma.portfolioAsset.findMany(),
      prisma.transaction.findMany({
        where: { date: { gte: firstDayOfMonth } },
        include: { category: true }
      }),
      prisma.category.findMany()
    ]);

    // Basic Metrics
    const totalCheckingBalance = checkingAccounts.reduce((acc, curr) => acc + curr.balance, 0);
    const totalSavingsLocked = savingsGoals.reduce((acc, curr) => acc + curr.currentAmount, 0);
    const safeToSpend = totalCheckingBalance - totalSavingsLocked;
    
    // Monthly Cash Flow
    let income = 0;
    let expenses = 0;
    const expensesByCategoryMap: Record<string, number> = {};

    allTransactions.forEach(tx => {
      if (tx.amount > 0) {
        income += tx.amount;
      } else {
        const absAmount = Math.abs(tx.amount);
        expenses += absAmount;
        expensesByCategoryMap[tx.category.name] = (expensesByCategoryMap[tx.category.name] || 0) + absAmount;
      }
    });

    const cashFlow = income - expenses;

    // Emergency Fund Months (Mocking avg expenses as 2000 if not enough data)
    const avgMonthlyExpenses = 2000; 
    const emergencyFundMonths = totalCheckingBalance / avgMonthlyExpenses;

    // Health Score (Savings Rate)
    const savingsRate = income > 0 ? (cashFlow / income) * 100 : 0;
    const healthScore = Math.min(Math.max(Math.round(savingsRate * 2), 0), 100);

    // Budget Details & Chart Data
    const BUDGET_TARGETS: Record<string, number> = {
      'Housing': 1200,
      'Food': 500,
      'Transport': 200,
      'Entertainment': 300,
      'Shopping': 300,
      'Uncategorized': 150,
    };

    const budgetDetails = categories
      .filter(cat => cat.type === 'expense')
      .map(cat => {
        const spent = expensesByCategoryMap[cat.name] || 0;
        const budget = BUDGET_TARGETS[cat.name] || 100;
        const remaining = budget - spent;
        const usedPct = (spent / budget) * 100;
        const allocationPct = (budget / Object.values(BUDGET_TARGETS).reduce((a, b) => a + b, 0)) * 100;

        return {
          categoryName: cat.name,
          allocationPct: Math.round(allocationPct),
          budgetedAmount: budget,
          spentAmount: spent,
          remainingAmount: remaining,
          usedPct: Math.round(usedPct)
        };
      });

    // 50/30/20 Rule
    const CATEGORY_GROUPS: Record<string, string> = {
      'Housing': 'Needs',
      'Food': 'Needs',
      'Transport': 'Needs',
      'Entertainment': 'Wants',
      'Shopping': 'Wants',
      'Uncategorized': 'Wants',
    };

    const ruleTotals = { Needs: 0, Wants: 0, Savings: cashFlow > 0 ? cashFlow : 0 };
    Object.entries(expensesByCategoryMap).forEach(([name, amt]) => {
      const group = CATEGORY_GROUPS[name] || 'Wants';
      if (group === 'Needs') ruleTotals.Needs += amt;
      else ruleTotals.Wants += amt;
    });

    const totalBudget = income || (ruleTotals.Needs + ruleTotals.Wants + ruleTotals.Savings) || 1;
    const rule503020 = {
      needs: { amount: ruleTotals.Needs, pct: Math.round((ruleTotals.Needs / totalBudget) * 100) },
      wants: { amount: ruleTotals.Wants, pct: Math.round((ruleTotals.Wants / totalBudget) * 100) },
      savings: { amount: ruleTotals.Savings, pct: Math.round((ruleTotals.Savings / totalBudget) * 100) },
    };

    // Chart Data
    const chartData = {
      expensesByCategory: Object.entries(expensesByCategoryMap).map(([name, value]) => ({ name, value })),
      budgetVsActual: budgetDetails.map(b => ({
        category: b.categoryName,
        budget: b.budgetedAmount,
        actual: b.spentAmount
      }))
    };

    const recentTransactions = await prisma.transaction.findMany({
      take: 10,
      orderBy: { date: 'desc' },
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
          portfolioValue: 12500, // Mocked as requested
          healthScore
        },
        budgetDetails,
        rule503020,
        chartData,
        totalCheckingBalance,
        totalSavingsLocked,
        safeToSpend,
        recentTransactions
      }
    });
  } catch (error) {
    console.error('Dashboard Aggregator Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
