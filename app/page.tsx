'use client';

import { useState, useEffect } from 'react';
import TopMetrics from './components/TopMetrics';
import DetailedBudgetTable from './components/DetailedBudgetTable';
import Rule503020Card from './components/Rule503020Card';
import Visualizations from './components/Visualizations';
import FinanceAgent from './components/FinanceAgent';
import InterestSimulator from './components/InterestSimulator';
import { Bell } from 'lucide-react';

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
  chartData: {
    expensesByCategory: { name: string; value: number }[];
    budgetVsActual: { category: string; budget: number; actual: number }[];
  };
  safeToSpend: number;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      } else {
        console.error('API Error:', result.error);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // SSE for real-time updates
    const eventSource = new EventSource('/api/events');
    eventSource.onmessage = (event: MessageEvent) => {
      if (event.data === 'refresh') {
        console.log('[SSE] Refresh event received');
        fetchData();
      }
    };

    const interval = setInterval(fetchData, 60000);
    return () => {
      clearInterval(interval);
      eventSource.close();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#131b2c] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!data) return null;

  const { metrics, budgetDetails, rule503020, chartData, safeToSpend } = data;

  return (
    <main className="min-h-screen bg-[#131b2c] text-slate-200 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Personal Wealth OS</h1>
            <p className="text-slate-500 text-sm mt-1">
              Welcome back. Your financial health score is <span className="text-orange-400 font-bold">{metrics.healthScore}%</span>.
            </p>
          </div>
          <div className="flex items-center gap-6 bg-slate-800/40 p-3 rounded-2xl border border-slate-700/50">
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Global Safe Balance</span>
              <p className="text-xl font-mono font-bold text-green-400">
                {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(safeToSpend)}
              </p>
            </div>
            <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center border border-slate-600">
              <span className="text-xs font-bold text-slate-300">JD</span>
            </div>
          </div>
        </header>

        <TopMetrics metrics={metrics} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <DetailedBudgetTable details={budgetDetails} />
          </div>
          <div className="space-y-8">
            <Rule503020Card rule={rule503020} />
            <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-4 h-4 text-orange-400" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Smart Alerts</h3>
              </div>
              <div className="space-y-3">
                {budgetDetails.some((b) => b.usedPct > 90) ? (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-[11px] text-red-400 font-medium">Critical: Budget exceeded in categories.</p>
                  </div>
                ) : (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <p className="text-[11px] text-green-400 font-medium">System Nominal: All spending within targets.</p>
                  </div>
                )}
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <p className="text-[11px] text-blue-400 font-medium">Advice: Portfolio rebalancing recommended.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Visualizations data={chartData} />

        {/* Wealth OS Tools */}
        <section className="pt-8 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
            <h2 className="text-2xl font-bold tracking-tight text-white">Wealth Projection Tools</h2>
          </div>
          <InterestSimulator />
        </section>
      </div>
      <FinanceAgent />
    </main>
  );
}
