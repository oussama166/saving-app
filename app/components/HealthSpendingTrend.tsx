'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { HealthSpendingPoint } from '@/lib/financials';

interface Props {
  data: HealthSpendingPoint[];
}

const formatCUR = (val: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(val);

export default function HealthSpendingTrend({ data }: Props) {
  const total = data.reduce((acc, m) => acc + m.amount, 0);
  const avg = data.length > 0 ? total / data.length : 0;

  return (
    <div className="bg-[#1b253b] rounded-2xl border border-slate-700 p-8 shadow-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-rose-400" />
          <h2 className="text-xl font-bold text-white tracking-tight">Tendance des Dépenses Santé</h2>
        </div>
        <span className="text-[10px] bg-rose-500/20 text-rose-400 px-2 py-1 rounded uppercase font-bold tracking-widest border border-rose-500/20">
          Moy. {formatCUR(avg)}/mois
        </span>
      </div>

      <div className="h-[220px]">
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
            <Bar dataKey="amount" name="Dépensé" fill="#fb7185" radius={[4, 4, 0, 0]} barSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
