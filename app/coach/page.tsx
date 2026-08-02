'use client';

import { useEffect, useState } from 'react';
import { Stethoscope, Award, Calculator, Building2 } from 'lucide-react';
import CoachDiagnosticTab from '../components/CoachDiagnosticTab';
import CoachGoldenRulesTab from '../components/CoachGoldenRulesTab';
import CoachBenchmarksTab from '../components/CoachBenchmarksTab';
import InterestSimulator from '../components/InterestSimulator';
import GoalSimulator from '../components/GoalSimulator';
import DebtPayoffSimulator from '../components/DebtPayoffSimulator';
import RetirementSimulator from '../components/RetirementSimulator';
import BigPurchaseSimulator from '../components/BigPurchaseSimulator';
import FeatureGate from '../components/FeatureGate';
import type { BudgetMethodResult } from '@/lib/budgetMethods';

interface DashboardData {
  metrics: {
    cashFlow: number;
    emergencyFundMonths: number;
    portfolioValue: number;
    healthScore: number;
  };
  budgetDetails: {
    categoryName: string;
    allocationPct: number;
    budgetedAmount: number;
    spentAmount: number;
    remainingAmount: number;
    usedPct: number;
  }[];
  // Le Diagnostic Coach IA suivait auparavant la répartition 50/30/20 quelle
  // que soit la méthode réellement choisie par l'utilisateur en page Profil
  // (lib/budgetMethods.ts) — désormais alimenté par la méthode réelle.
  budgetMethod: string;
  budgetMethodResult: BudgetMethodResult | null;
  budgetMethodTotals: { essential: number; discretionary: number; savings: number };
  referenceIncome: number;
  avgMonthlyExpenses: number;
}

const TABS = [
  { key: 'diagnostic', label: 'Diagnostic', icon: Stethoscope },
  { key: 'regles', label: "Règles d'Or", icon: Award },
  { key: 'simulations', label: 'Simulations', icon: Calculator },
  { key: 'benchmarks', label: 'Benchmarks Maroc', icon: Building2 },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function CoachPage() {
  return (
    <FeatureGate featureKey="coach" featureName="Coach IA">
      <CoachPageContent />
    </FeatureGate>
  );
}

function CoachPageContent() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('diagnostic');

  useEffect(() => {
    fetch('/api/dashboard')
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setData(result.data);
      })
      .catch((err) => console.error('Coach IA dashboard fetch error:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-page p-4 sm:p-6 lg:p-8 text-body font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Coach IA</h1>
          <p className="text-subtle text-sm mt-1 italic">
            Diagnostic, règles d&apos;or, simulations et benchmarks pour progresser financièrement.
          </p>
        </header>

        <div className="flex gap-2 border-b border-line-subtle overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
                tab === t.key
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-subtle hover:text-body-soft'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
          </div>
        ) : (
          <div>
            {tab === 'diagnostic' &&
              (data ? (
                <CoachDiagnosticTab
                  budgetDetails={data.budgetDetails}
                  budgetMethodKey={data.budgetMethod}
                  budgetMethodResult={data.budgetMethodResult}
                  emergencyFundMonths={data.metrics.emergencyFundMonths}
                  healthScore={data.metrics.healthScore}
                />
              ) : (
                <p className="text-sm text-subtle italic">Impossible de charger les données du dashboard.</p>
              ))}

            {tab === 'regles' && (
              <CoachGoldenRulesTab
                referenceIncome={data?.referenceIncome ?? 10000}
                avgMonthlyExpenses={data?.avgMonthlyExpenses ?? 5000}
              />
            )}

            {tab === 'simulations' && (
              <div className="space-y-6">
                <InterestSimulator />
                <GoalSimulator />
                <DebtPayoffSimulator />
                <RetirementSimulator initialCapital={data?.metrics.portfolioValue ?? 0} />
                <BigPurchaseSimulator referenceIncome={data?.referenceIncome ?? 10000} />
              </div>
            )}

            {tab === 'benchmarks' && (
              <CoachBenchmarksTab
                referenceIncome={data?.referenceIncome ?? 0}
                avgMonthlyExpenses={data?.avgMonthlyExpenses ?? 0}
                monthlySavings={data?.budgetMethodTotals.savings ?? 0}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
