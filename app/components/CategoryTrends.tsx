'use client';

import { TrendingUp, TrendingDown, Minus, Sparkle } from 'lucide-react';
import type { CategoryTrend } from '@/lib/financials';

interface Props {
  data: CategoryTrend[];
}

const formatCUR = (val: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(val);

export default function CategoryTrends({ data }: Props) {
  const maxTotal = Math.max(...data.map((c) => c.total), 1);

  return (
    <div className="bg-[#1b253b] rounded-2xl border border-slate-700 p-8 shadow-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white tracking-tight">Top Catégories du Semestre</h2>
        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-1 rounded uppercase font-bold tracking-widest border border-blue-500/20">
          Cumul 6 mois
        </span>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-slate-500 italic">Pas encore assez de données pour établir un classement.</p>
      ) : (
        <div className="space-y-4">
          {data.map((cat, i) => (
            <div key={cat.name} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-600">#{i + 1}</span>
                  <span className="text-xs font-semibold text-slate-200">{cat.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-300">{formatCUR(cat.total)}</span>
                  {cat.trendPct === null ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-blue-400">
                      <Sparkle className="w-3 h-3" />
                      Nouveau
                    </span>
                  ) : cat.trendPct === 0 ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                      <Minus className="w-3 h-3" />
                      Stable
                    </span>
                  ) : (
                    <span
                      className={`flex items-center gap-1 text-[10px] font-bold ${
                        cat.trendPct > 0 ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {cat.trendPct > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {cat.trendPct > 0 ? '+' : ''}
                      {cat.trendPct}%
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500/70"
                  style={{ width: `${Math.max((cat.total / maxTotal) * 100, 3)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
