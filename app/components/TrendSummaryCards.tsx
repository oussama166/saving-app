'use client';

import { TrendingUp, TrendingDown, Wallet, PiggyBank } from 'lucide-react';
import type { MonthlyAnalytics } from '@/lib/financials';

interface Props {
  data: MonthlyAnalytics[];
}

const formatCUR = (val: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(val);

export default function TrendSummaryCards({ data }: Props) {
  const withActivity = data.filter((m) => m.income > 0 || m.expenses > 0);
  const count = withActivity.length || 1;

  const avgExpenses = withActivity.reduce((acc, m) => acc + m.expenses, 0) / count;
  const avgSavings = withActivity.reduce((acc, m) => acc + m.savings, 0) / count;

  const bestMonth = withActivity.reduce<MonthlyAnalytics | null>(
    (best, m) => (!best || m.savingsRatePct > best.savingsRatePct ? m : best),
    null,
  );
  const worstMonth = withActivity.reduce<MonthlyAnalytics | null>(
    (worst, m) => (!worst || m.expenses > worst.expenses ? m : worst),
    null,
  );

  const cards = [
    {
      label: 'Dépense Moyenne / Mois',
      value: formatCUR(avgExpenses),
      icon: Wallet,
      color: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/20',
    },
    {
      label: 'Épargne Moyenne / Mois',
      value: formatCUR(avgSavings),
      icon: PiggyBank,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      label: 'Meilleur Mois',
      value: bestMonth ? `${bestMonth.label} · ${bestMonth.savingsRatePct}% épargné` : '—',
      icon: TrendingUp,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
    },
    {
      label: 'Mois le Plus Dépensier',
      value: worstMonth ? `${worstMonth.label} · ${formatCUR(worstMonth.expenses)}` : '—',
      icon: TrendingDown,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10 border-orange-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className={`p-4 rounded-xl border ${c.bg}`}>
          <div className="flex items-center gap-2 mb-2">
            <c.icon className={`w-4 h-4 ${c.color}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted">{c.label}</span>
          </div>
          <p className={`text-lg font-black ${c.color}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}
