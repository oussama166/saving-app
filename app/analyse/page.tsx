import React from 'react';
import { getUserSettings, getFinancialRatios, getMonthlyAnalytics, getTopCategoriesTrend } from '@/lib/financials';
import MonthlyHistoryTable from '../components/MonthlyHistoryTable';
import FinancialRatios from '../components/FinancialRatios';
import TrendSummaryCards from '../components/TrendSummaryCards';
import CategoryTrends from '../components/CategoryTrends';
import TrendsInsight from '../components/TrendsInsight';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AnalysePage() {
  const { userId } = await requireSession();
  const { referenceIncome } = await getUserSettings(userId);
  const [monthly, ratios, topCategories] = await Promise.all([
    getMonthlyAnalytics(userId, 6),
    getFinancialRatios(userId, referenceIncome),
    getTopCategoriesTrend(userId, 6, 5),
  ]);

  return (
    <main className="min-h-screen bg-page p-4 sm:p-6 lg:p-8 text-body font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Analyse & Trends</h1>
          <p className="text-subtle text-sm mt-1 italic">
            Comprendre vos tendances financières pour mieux décider demain.
          </p>
        </header>

        <TrendSummaryCards data={monthly} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2">
            <MonthlyHistoryTable data={monthly} />
          </div>
          <FinancialRatios ratios={ratios} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2">
            <CategoryTrends data={topCategories} />
          </div>
          <TrendsInsight monthly={monthly} topCategories={topCategories} />
        </div>
      </div>
    </main>
  );
}
