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
  // GoalsTable gère désormais son propre fetch (liste, comptes, catégories,
  // rattrapage des versements auto) côté client — ici on ne garde qu'un
  // agrégat léger pour les conseils Tanger ci-dessous.
  const [goalsAgg, { referenceIncome }, emergencyFundBalance, portfolio] = await Promise.all([
    prisma.savingsGoal.aggregate({ where: { userId }, _sum: { targetAmount: true, currentAmount: true } }),
    getUserSettings(userId),
    getEmergencyFundBalance(userId),
    getEnrichedPortfolioAssets(userId),
  ]);

  const totalGoalsTarget = goalsAgg._sum.targetAmount ?? 0;
  const totalGoalsSaved = goalsAgg._sum.currentAmount ?? 0;

  return (
    <main className="min-h-screen bg-page p-4 sm:p-6 lg:p-8 text-body font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Objectifs Personnels & Financiers</h1>
          <p className="text-subtle text-sm mt-1 italic">
            La discipline d&apos;aujourd&apos;hui crée la liberté de demain.
          </p>
        </header>

        <GoalsTable />

        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
            <h2 className="text-xl font-bold tracking-tight text-ink">La Magie des Intérêts Composés</h2>
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
