import React from 'react';
import { prisma } from '@/lib/prisma';
import { getUserSettings, getEmergencyFundBalance } from '@/lib/financials';
import { getEnrichedPortfolioAssets } from '@/lib/portfolio';
import GoalsTable from '../components/GoalsTable';
import InterestSimulator from '../components/InterestSimulator';
import TangerFinancialAdvice from '../components/TangerFinancialAdvice';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ObjectifsPage() {
  const { userId } = await requireSession();
  const [goals, { referenceIncome }, emergencyFundBalance, portfolio] = await Promise.all([
    prisma.savingsGoal.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    getUserSettings(userId),
    getEmergencyFundBalance(userId),
    getEnrichedPortfolioAssets(userId),
  ]);

  const totalGoalsTarget = goals.reduce((acc, g) => acc + g.targetAmount, 0);
  const totalGoalsSaved = goals.reduce((acc, g) => acc + g.currentAmount, 0);

  return (
    <main className="min-h-screen bg-[#131b2c] p-8 text-slate-200 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-white">Objectifs Personnels & Financiers</h1>
          <p className="text-slate-500 text-sm mt-1 italic">
            La discipline d&apos;aujourd&apos;hui crée la liberté de demain.
          </p>
        </header>

        <GoalsTable goals={goals} />

        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
            <h2 className="text-xl font-bold tracking-tight text-white">La Magie des Intérêts Composés</h2>
          </div>
          <InterestSimulator showChart={false} />
        </section>

        <TangerFinancialAdvice
          referenceIncome={referenceIncome}
          emergencyFundBalance={emergencyFundBalance}
          portfolioValue={portfolio.globalLiveValue}
          totalGoalsTarget={totalGoalsTarget}
          totalGoalsSaved={totalGoalsSaved}
        />
      </div>
    </main>
  );
}
