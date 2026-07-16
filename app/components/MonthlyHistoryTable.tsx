'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { MonthlyAnalytics } from '@/lib/financials';

interface Props {
  data: MonthlyAnalytics[];
}

const formatCUR = (val: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(val);

export default function MonthlyHistoryTable({ data }: Props) {
  return (
    <div className="bg-surface rounded-2xl border border-line p-8 shadow-2xl space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-ink tracking-tight">Historique Mensuel</h2>
        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-1 rounded uppercase font-bold tracking-widest border border-blue-500/20">
          6 derniers mois
        </span>
      </div>

      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v} DH`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
              itemStyle={{ color: '#f1f5f9' }}
              formatter={(value) => formatCUR(Number(value))}
            />
            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
            <Bar dataKey="expenses" name="Dépenses" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={24} />
            <Bar dataKey="savings" name="Épargne / Invest" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] text-subtle uppercase tracking-widest border-b border-line-subtle">
              <th className="pb-3 font-bold">Mois</th>
              <th className="pb-3 font-bold text-right">Revenu</th>
              <th className="pb-3 font-bold text-right">Dépensé</th>
              <th className="pb-3 font-bold text-right">Épargne/Invest</th>
              <th className="pb-3 font-bold text-right">% Épargné</th>
              <th className="pb-3 font-bold">Top Catégorie</th>
              <th className="pb-3 font-bold text-right">Variation</th>
            </tr>
          </thead>
          <tbody>
            {[...data].reverse().map((m) => (
              <tr key={m.month} className="border-b border-line-subtle/50 last:border-0">
                <td className="py-3 text-sm font-semibold text-body capitalize">{m.label}</td>
                <td className="py-3 text-sm text-right text-body-soft font-mono">{formatCUR(m.income)}</td>
                <td className="py-3 text-sm text-right text-red-400 font-mono">{formatCUR(m.expenses)}</td>
                <td className="py-3 text-sm text-right text-emerald-400 font-mono">{formatCUR(m.savings)}</td>
                <td className="py-3 text-sm text-right text-body-soft">{m.savingsRatePct}%</td>
                <td className="py-3 text-sm text-muted">
                  {m.topCategory ? `${m.topCategory.name} (${formatCUR(m.topCategory.amount)})` : '—'}
                </td>
                <td className="py-3 text-sm text-right">
                  {m.variationPct === null ? (
                    <span className="text-faint">—</span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 font-bold ${
                        m.variationPct > 0
                          ? 'text-red-400'
                          : m.variationPct < 0
                            ? 'text-emerald-400'
                            : 'text-muted'
                      }`}
                    >
                      {m.variationPct > 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : m.variationPct < 0 ? (
                        <TrendingDown className="w-3 h-3" />
                      ) : null}
                      {m.variationPct > 0 ? '+' : ''}
                      {m.variationPct}%
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
