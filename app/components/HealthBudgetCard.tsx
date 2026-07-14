'use client';

import { HeartPulse } from 'lucide-react';
import type { HealthBudget } from '@/lib/financials';

interface Props {
  budget: HealthBudget;
}

const formatCUR = (val: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(val);

export default function HealthBudgetCard({ budget }: Props) {
  const usedPct = budget.plannedMonthly > 0 ? Math.min((budget.spentThisMonth / budget.plannedMonthly) * 100, 100) : 0;
  const overBudget = budget.remaining < 0;

  return (
    <div className="bg-[#1b253b] rounded-2xl border border-slate-700 p-8 shadow-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HeartPulse className="w-6 h-6 text-rose-400" />
          <h2 className="text-xl font-bold text-white tracking-tight">Budget Santé Mensuel</h2>
        </div>
        <span className="text-[10px] bg-rose-500/20 text-rose-400 px-2 py-1 rounded uppercase font-bold tracking-widest border border-rose-500/20">
          {budget.budgetPct}% du revenu
        </span>
      </div>

      <div>
        <div className="flex justify-between items-end mb-2">
          <span className="text-3xl font-bold text-slate-200">{formatCUR(budget.spentThisMonth)}</span>
          <span className="text-slate-500 font-medium text-sm mb-1">Prévu : {formatCUR(budget.plannedMonthly)}</span>
        </div>
        <div className="bg-[#131b2c] rounded-full h-4 w-full overflow-hidden border border-slate-800">
          <div
            className={`h-full transition-all duration-1000 ease-out ${overBudget ? 'bg-red-500' : 'bg-rose-400'}`}
            style={{ width: `${usedPct}%` }}
          />
        </div>
        <p
          className={`text-right text-xs font-bold mt-2 uppercase tracking-wider ${
            overBudget ? 'text-red-400' : 'text-rose-400'
          }`}
        >
          {usedPct.toFixed(1)}% du budget utilisé
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Restant ce mois</span>
          <p className={`text-lg font-bold mt-1 ${overBudget ? 'text-red-400' : 'text-emerald-400'}`}>
            {formatCUR(budget.remaining)}
          </p>
        </div>
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Budget Annuel Est.</span>
          <p className="text-lg font-bold text-slate-300 mt-1">{formatCUR(budget.estimatedAnnual)}</p>
        </div>
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Poids sur Revenu</span>
          <p className="text-lg font-bold text-slate-300 mt-1">{budget.weightOnIncomePct}%</p>
        </div>
      </div>
    </div>
  );
}
