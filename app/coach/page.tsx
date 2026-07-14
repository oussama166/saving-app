'use client';

import { useEffect, useState } from 'react';
import { Stethoscope, Award, Calculator, Building2 } from 'lucide-react';
import CoachDiagnosticTab from '../components/CoachDiagnosticTab';
import CoachGoldenRulesTab from '../components/CoachGoldenRulesTab';
import CoachBenchmarksTab from '../components/CoachBenchmarksTab';
import InterestSimulator from '../components/InterestSimulator';

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
  rule503020: {
    needs: { amount: number; pct: number };
    wants: { amount: number; pct: number };
    savings: { amount: number; pct: number };
  };
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
    <main className="min-h-screen bg-[#131b2c] p-8 text-slate-200 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-white">Coach IA</h1>
          <p className="text-slate-500 text-sm mt-1 italic">
            Diagnostic, règles d&apos;or, simulations et benchmarks pour progresser financièrement.
          </p>
        </header>

        <div className="flex gap-2 border-b border-slate-800 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
                tab === t.key
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
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
                  rule503020={data.rule503020}
                  emergencyFundMonths={data.metrics.emergencyFundMonths}
                  healthScore={data.metrics.healthScore}
                />
              ) : (
                <p className="text-sm text-slate-500 italic">Impossible de charger les données du dashboard.</p>
              ))}

            {tab === 'regles' && (
              <CoachGoldenRulesTab
                referenceIncome={data?.referenceIncome ?? 10000}
                avgMonthlyExpenses={data?.avgMonthlyExpenses ?? 5000}
              />
            )}

            {tab === 'simulations' && <InterestSimulator />}

            {tab === 'benchmarks' && <CoachBenchmarksTab />}
          </div>
        )}
      </div>
    </main>
  );
}
