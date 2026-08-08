'use client';

import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useLanguage } from './LanguageProvider';

interface HistoryPoint {
  date: string;
  netWorthMad: number;
  checkingBalanceMad: number;
  savingsLockedMad: number;
  portfolioValueMad: number;
  debtsMad: number;
}

const RANGE_OPTIONS = [
  { key: 30, label: '30j' },
  { key: 90, label: '90j' },
  { key: 180, label: '6 mois' },
] as const;

// Évolution du patrimoine net dans le temps (voir lib/netWorthHistory.ts) —
// un point est capturé chaque jour où le dashboard est ouvert (upsert
// idempotent, pas de cron), donc l'historique se remplit progressivement à
// partir d'aujourd'hui plutôt que d'être rétroactif.
export default function NetWorthChart() {
  const { locale } = useLanguage();
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<number>(90);

  useEffect(() => {
    // setLoading(true) différé en microtask (voir react-hooks/set-state-in-effect)
    // : évite qu'un setState synchrone en tout début d'effet soit traité
    // comme direct par la règle de lint, même pattern que app/page.tsx.
    Promise.resolve().then(() => setLoading(true));
    fetch(`/api/dashboard/net-worth-history?days=${days}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setHistory(result.data);
      })
      .catch((err) => console.error('Net worth history fetch error:', err))
      .finally(() => setLoading(false));
  }, [days]);

  const formatCUR = (val: number) =>
    new Intl.NumberFormat(`${locale}-MA`, { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(val);

  const formatDateShort = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  const chartData = history.map((p) => ({ ...p, dateLabel: formatDateShort(p.date) }));
  const latest = history[history.length - 1];
  const first = history[0];
  const trend = latest && first ? latest.netWorthMad - first.netWorthMad : 0;

  return (
    <div dir="ltr" className="bg-surface-alt/50 border border-line p-6 rounded-2xl">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted">Évolution du patrimoine net</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.key}
              onClick={() => setDays(r.key)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-colors ${
                days === r.key
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-surface-alt text-subtle border-line hover:text-body'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-[280px] flex items-center justify-center">
          <div className="w-8 h-8 border-b-2 border-emerald-500 rounded-full animate-spin" />
        </div>
      ) : history.length < 2 ? (
        <div className="h-[200px] flex items-center justify-center">
          <p className="text-[12px] text-subtle italic text-center max-w-sm">
            Pas encore assez d&apos;historique — un point est enregistré à chaque visite du dashboard, reviens dans
            quelques jours pour voir la courbe se dessiner.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-3 mb-4">
            <p className="text-2xl font-black text-ink">{formatCUR(latest.netWorthMad)}</p>
            {trend !== 0 && (
              <span className={`text-[12px] font-bold ${trend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {trend > 0 ? '+' : ''}
                {formatCUR(trend)} sur la période
              </span>
            )}
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="dateLabel"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  minTickGap={40}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                  itemStyle={{ color: '#f1f5f9' }}
                  formatter={(value) => formatCUR(Number(value))}
                  labelFormatter={(label) => label}
                />
                <Area
                  type="monotone"
                  dataKey="netWorthMad"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorNetWorth)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
